import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Play, Square, Mic, MicOff, Globe, Volume2, VolumeX, Pause, RotateCcw, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import HistoricalFigureSearch from "./HistoricalFigureSearch";
import ChatMessages from "./ChatMessages";
import RealisticAvatar from "./RealisticAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  speakerName?: string;
  sourcesUsed?: {
    books: number;
    documents: number;
    youtube: number;
    wikipedia: boolean;
    currentEvents: number;
    historicalContext: number;
    webArticles: number;
  };
}

export interface HistoricalFigure {
  id: string;
  name: string;
  period: string;
  description: string;
  avatar: string;
}

const PodcastMode = () => {
  console.log("PodcastMode component loading...");
  
  // Figure selection
  const [host, setHost] = useState<HistoricalFigure | null>(null);
  const [guest, setGuest] = useState<HistoricalFigure | null>(null);
  const [selectingFor, setSelectingFor] = useState<'host' | 'guest' | null>(null);
  const [hostType, setHostType] = useState<'user' | 'figure'>('figure');
  const [guestType, setGuestType] = useState<'user' | 'figure'>('figure');
  const [userInput, setUserInput] = useState("");
  
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'host' | 'guest'>('host');
  const [podcastTopic, setPodcastTopic] = useState("");
  const [isPodcastActive, setIsPodcastActive] = useState(false);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [speakerCount, setSpeakerCount] = useState(0);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [podcastSessionId, setPodcastSessionId] = useState<string | null>(null);
  const [isProcessingUserQuestion, setIsProcessingUserQuestion] = useState(false);
  
  // Audio state
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [hostVoice, setHostVoice] = useState<string>('auto');
  const [guestVoice, setGuestVoice] = useState<string>('auto');
  
  // Avatar state
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);
  const [guestAvatarUrl, setGuestAvatarUrl] = useState<string | null>(null);
  const [isLoadingHostAvatar, setIsLoadingHostAvatar] = useState(false);
  const [isLoadingGuestAvatar, setIsLoadingGuestAvatar] = useState(false);
  
  // Video state - video-first approach
  const [hostVideoUrl, setHostVideoUrl] = useState<string | null>(null);
  const [guestVideoUrl, setGuestVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentVideoSpeaker, setCurrentVideoSpeaker] = useState<'host' | 'guest' | null>(null);
  
  // Preloading state
  const [preloadedVideoUrl, setPreloadedVideoUrl] = useState<string | null>(null);
  const [preloadedSpeaker, setPreloadedSpeaker] = useState<'host' | 'guest' | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  
  const videoQueueRef = useRef<Array<{speaker: 'host' | 'guest', text: string, figureName: string, figureId: string}>>([]);
  const isProcessingVideoRef = useRef(false);
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  const messagesRef = useRef<Message[]>([]);
  
  const { toast } = useToast();

  // Azure voice options filtered by gender
  const azureVoices = {
    male: [
      { value: 'en-US-GuyNeural', label: 'American English' },
      { value: 'en-GB-RyanNeural', label: 'British English' },
      { value: 'en-AU-WilliamNeural', label: 'Australian English' },
      { value: 'en-CA-LiamNeural', label: 'Canadian English' },
      { value: 'en-IN-PrabhatNeural', label: 'Indian English' },
    ],
    female: [
      { value: 'en-US-JennyNeural', label: 'American English' },
      { value: 'en-GB-SoniaNeural', label: 'British English' },
      { value: 'en-AU-NatashaNeural', label: 'Australian English' },
      { value: 'en-CA-ClaraNeural', label: 'Canadian English' },
      { value: 'en-IN-NeerjaNeural', label: 'Indian English' },
    ],
  };

  // Detect gender helper
  const detectGender = (name: string): 'male' | 'female' => {
    const nameLower = name.toLowerCase();
    const femaleNames = [
      'joan of arc', 'cleopatra', 'marie curie', 'rosa parks', 'mother teresa',
      'victoria', 'elizabeth', 'catherine', 'anne frank', 'amelia earhart',
      'harriet tubman', 'malala', 'frida kahlo', 'ada lovelace', 'florence nightingale',
      'jane austen', 'emily dickinson', 'virginia woolf', 'simone de beauvoir',
      'eleanor roosevelt', 'margaret thatcher', 'indira gandhi', 'benazir bhutto',
      'mary', 'anne', 'jane', 'emily', 'rosa', 'harriet', 'ada', 'florence'
    ];
    if (femaleNames.some(n => nameLower.includes(n))) {
      return 'female';
    }
    return 'male';
  };

  // Auto-select Australian English for Elon Musk
  useEffect(() => {
    if (host && (host.id === 'elon-musk' || host.name.toLowerCase().includes('elon musk')) && hostVoice === 'auto') {
      setHostVoice('en-AU-WilliamNeural');
      console.log('🎙️ Auto-selected Australian English for Elon Musk (host)');
    }
    if (guest && (guest.id === 'elon-musk' || guest.name.toLowerCase().includes('elon musk')) && guestVoice === 'auto') {
      setGuestVoice('en-AU-WilliamNeural');
      console.log('🎙️ Auto-selected Australian English for Elon Musk (guest)');
    }
  }, [host, guest]);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize speech recognition
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState("");

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsListening(true);
        setIsRecording(true);
        setRecordingTranscript("");
        console.log('Voice recognition started in', selectedLanguage);
      };
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setRecordingTranscript(interimTranscript);

        if (finalTranscript) {
          setPodcastTopic(prev => prev + finalTranscript + ' ');
          setRecordingTranscript("");
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsRecording(false);
        setRecordingTranscript("");
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
        setRecordingTranscript("");
        console.log('Voice recognition ended');
      };
      
      setRecognition(recognition);
    }
  }, [selectedLanguage]);

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  const handleFigureSelect = (figure: HistoricalFigure) => {
    if (selectingFor === 'host') {
      setHost(figure);
      loadAvatarForFigure(figure, 'host');
    } else if (selectingFor === 'guest') {
      setGuest(figure);
      loadAvatarForFigure(figure, 'guest');
    }
    setSelectingFor(null);
  };

  const loadAvatarForFigure = async (figure: HistoricalFigure, role: 'host' | 'guest') => {
    const setLoading = role === 'host' ? setIsLoadingHostAvatar : setIsLoadingGuestAvatar;
    const setAvatarUrl = role === 'host' ? setHostAvatarUrl : setGuestAvatarUrl;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-avatar-portrait', {
        body: { 
          figureName: figure.name,
          figureId: figure.id,
          context: 'podcast studio with professional microphone and soundproofing'
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setAvatarUrl(data.imageUrl);
      }
    } catch (error) {
      console.error(`Error loading ${role} avatar:`, error);
      toast({
        title: "Avatar loading failed",
        description: `Could not load ${role} avatar. Using default.`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startPodcast = async () => {
    // Check if we have the necessary participants
    const hasHost = hostType === 'user' || host;
    const hasGuest = guestType === 'user' || guest;
    
    if (!hasHost || !hasGuest || !podcastTopic.trim()) {
      toast({
        title: "Missing information",
        description: "Please select participants and provide a topic.",
        variant: "destructive"
      });
      return;
    }

    setIsPodcastActive(true);
    setIsRecording(true);
    
    try {
      // Create podcast session in database
      const hostId = hostType === 'user' ? 'user-host' : host!.id;
      const hostName = hostType === 'user' ? 'Host' : host!.name;
      const guestId = guestType === 'user' ? 'user-guest' : guest!.id;
      const guestName = guestType === 'user' ? 'Guest' : guest!.name;

      const { data: sessionData, error: sessionError } = await supabase
        .from('podcast_sessions')
        .insert({
          host_id: hostId,
          host_name: hostName,
          guest_id: guestId,
          guest_name: guestName,
          topic: podcastTopic,
          language: selectedLanguage.split('-')[0],
          status: 'active',
          current_turn: 0
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      
      setPodcastSessionId(sessionData.id);
      setMessages([]);
      setCurrentRound(1);
      setSpeakerCount(0);
      setWaitingForContinue(false);

      // Generate first round based on who is AI
      if (hostType === 'figure') {
        // Host is AI - generate host intro
        const { data: firstResponse, error: firstError } = await supabase.functions.invoke('podcast-orchestrator', {
          body: {
            sessionId: sessionData.id,
            language: selectedLanguage.split('-')[0]
          }
        });

        if (firstError) throw firstError;

        // Add first message (host intro) to UI
        const hostMessage: Message = {
          id: Date.now().toString(),
          content: firstResponse.message,
          type: "assistant",
          timestamp: new Date(),
          speakerName: firstResponse.speaker.name
        };
        
        setMessages([hostMessage]);
        setCurrentSpeaker('host');
        
        // Generate and play video for host
        if (isAutoVoiceEnabled) {
          await generateAndPlayAudio(firstResponse.message, hostName, hostId, 'host');
        }

        // Generate guest response
        const { data: secondResponse, error: secondError } = await supabase.functions.invoke('podcast-orchestrator', {
          body: {
            sessionId: sessionData.id,
            language: selectedLanguage.split('-')[0]
          }
        });

        if (secondError) throw secondError;

        const guestMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: secondResponse.message,
          type: "assistant",
          timestamp: new Date(),
          speakerName: secondResponse.speaker.name
        };

        setMessages([hostMessage, guestMessage]);
        setSpeakerCount(2);
        setCurrentRound(1);
        setCurrentSpeaker('host');

        // Generate and play video for guest
        if (isAutoVoiceEnabled && guestType === 'figure') {
          await generateAndPlayAudio(secondResponse.message, guestName, guestId, 'guest');
        }

        // Set up for next round
        if (guestType === 'figure') {
          setWaitingForContinue(true);
        } else {
          setWaitingForUser(true);
          setCurrentSpeaker('guest');
        }
      } else {
        // User is host - generate intro for user
        const { data: firstResponse, error: firstError } = await supabase.functions.invoke('podcast-orchestrator', {
          body: {
            sessionId: sessionData.id,
            language: selectedLanguage.split('-')[0]
          }
        });

        if (firstError) throw firstError;

        // Add user's intro to UI
        const hostMessage: Message = {
          id: Date.now().toString(),
          content: firstResponse.message,
          type: "user",
          timestamp: new Date(),
          speakerName: hostName
        };
        
        setMessages([hostMessage]);
        setCurrentSpeaker('host');
        
        // Generate and play video for host intro
        if (isAutoVoiceEnabled) {
          await generateAndPlayAudio(firstResponse.message, hostName, hostId, 'host');
        }
        
        // Generate guest response
        const { data: secondResponse, error: secondError } = await supabase.functions.invoke('podcast-orchestrator', {
          body: {
            sessionId: sessionData.id,
            language: selectedLanguage.split('-')[0]
          }
        });

        if (secondError) throw secondError;

        const guestMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: secondResponse.message,
          type: "assistant",
          timestamp: new Date(),
          speakerName: guestName
        };

        setMessages([hostMessage, guestMessage]);
        setSpeakerCount(2);
        setCurrentRound(1);
        setCurrentSpeaker('guest');

        // Generate and play video for guest
        if (isAutoVoiceEnabled) {
          await generateAndPlayAudio(secondResponse.message, guestName, guestId, 'guest');
        }

        // After intro, ready for user's first question (no Continue button needed)
      }
    } catch (error) {
      console.error('Error starting podcast:', error);
      toast({
        title: "Error",
        description: "Failed to start podcast. Please try again.",
        variant: "destructive"
      });
      setIsRecording(false);
      setIsPodcastActive(false);
    }
  };

  const stopPodcast = () => {
    setCurrentSpeaker('host');
    
    // Stop any playing video
    if (currentVideoRef.current) {
      currentVideoRef.current.pause();
      currentVideoRef.current.currentTime = 0;
    }
    
    setIsPlayingVideo(false);
    setIsPaused(false);
    setIsStopped(true);
    setHostVideoUrl(null);
    setGuestVideoUrl(null);
    
    // Clear video queue
    videoQueueRef.current = [];
    isProcessingVideoRef.current = false;
    
    toast({
      title: "Podcast stopped",
      description: "Click Continue to resume",
    });
  };

  const handlePauseVideo = () => {
    if (currentVideoRef.current && isPlayingVideo) {
      currentVideoRef.current.pause();
      setIsPlayingVideo(false);
      setIsPaused(true);
    }
    
    toast({
      title: "Paused",
      description: "Video paused",
      duration: 2000,
    });
  };

  const handleResumeVideo = () => {
    if (currentVideoRef.current && isPaused) {
      currentVideoRef.current.play();
      setIsPlayingVideo(true);
      setIsPaused(false);
    }
    
    toast({
      title: "Resumed",
      description: "Video resumed",
      duration: 2000,
    });
  };

  const handleReplayVideo = () => {
    if (currentVideoRef.current) {
      currentVideoRef.current.currentTime = 0;
      currentVideoRef.current.play();
      setIsPlayingVideo(true);
      setIsPaused(false);
      setIsStopped(false);
    }
    
    toast({
      title: "Replaying",
      description: "Video replaying from start",
      duration: 2000,
    });
  };

  const handleUserQuestion = async (questionContent: string) => {
    if (!podcastSessionId || !guest) {
      console.error('Missing session data');
      return;
    }

    console.log('🎙️ User asking question to guest');
    
    // Stop any playing video
    if (currentVideoRef.current) {
      currentVideoRef.current.pause();
      currentVideoRef.current.currentTime = 0;
    }
    setIsPlayingVideo(false);
    setIsPaused(false);
    videoQueueRef.current = [];
    isProcessingVideoRef.current = false;

    try {
      // Insert user question into podcast_messages table
      const { error: insertError } = await supabase
        .from('podcast_messages')
        .insert({
          podcast_session_id: podcastSessionId,
          turn_number: -1,
          figure_id: 'user',
          figure_name: 'User',
          speaker_role: 'user',
          content: questionContent,
        });
      
      if (insertError) {
        console.error('Error saving user question:', insertError);
      }
      
      // Guest responds to user's question
      const { data: guestData, error: guestError } = await supabase.functions.invoke('podcast-orchestrator', {
        body: {
          sessionId: podcastSessionId,
          language: selectedLanguage.split('-')[0],
          userQuestion: true,
          forceSpeaker: 'guest'
        }
      });

      if (guestError) throw guestError;

      const guestMessage: Message = {
        id: Date.now().toString(),
        content: guestData.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: guest.name
      };

      setMessages(prev => [...prev, guestMessage]);

      if (isAutoVoiceEnabled) {
        await generateAndPlayAudio(guestData.message, guest.name, guest.id, 'guest');
      }
      
      console.log('✅ Guest answered user question');

    } catch (error) {
      console.error('Error handling user question:', error);
      toast({
        title: "Error",
        description: "Failed to generate guest response",
        variant: "destructive"
      });
    }
  };

  const continueConversation = async (
    speaker: 'host' | 'guest', 
    shouldPauseAfter: boolean = true
  ) => {
    // Ignore normal turns if user question is being processed
    if (isProcessingUserQuestion) {
      console.log('⚠️ Ignoring normal turn - user question in progress');
      return null;
    }

    // Check if it's user's turn
    if ((speaker === 'host' && hostType === 'user') || (speaker === 'guest' && guestType === 'user')) {
      setWaitingForUser(true);
      setCurrentSpeaker(speaker);
      toast({
        title: "Your turn!",
        description: "Record your response or type it below.",
        duration: 3000,
      });
      return null;
    }

    if (!podcastSessionId) {
      console.error('No podcast session ID');
      return null;
    }

    const currentFigure = speaker === 'host' ? host : guest;
    if (!currentFigure) return null;

    setCurrentSpeaker(speaker);
    setWaitingForContinue(false);

    try {
      // Call podcast orchestrator to generate next response
      const { data, error } = await supabase.functions.invoke('podcast-orchestrator', {
        body: {
          sessionId: podcastSessionId,
          language: selectedLanguage.split('-')[0]
        }
      });

      if (error) throw error;

      const responseMessage: Message = {
        id: Date.now().toString(),
        content: data.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: data.speaker.name
      };

      setMessages(prev => [...prev, responseMessage]);
      
      // Increment speaker count and round after both speakers have spoken
      setSpeakerCount(prevCount => {
        const newCount = prevCount + 1;
        if (newCount % 2 === 0) {
          setCurrentRound(prevRound => prevRound + 1);
        }
        return newCount;
      });

      // Generate and play video
      if (isAutoVoiceEnabled) {
        const figureName = currentFigure.name;
        const figureId = currentFigure.id;
        const speakerRole: 'host' | 'guest' = speaker;
        console.log(`🎤 Generating video for ${figureName} (${figureId})`);
        await generateAndPlayAudio(data.message, figureName, figureId, speakerRole);
      }
      
      // Set up next turn
      const nextSpeaker = speaker === 'host' ? 'guest' : 'host';
      if ((nextSpeaker === 'host' && hostType === 'user') || (nextSpeaker === 'guest' && guestType === 'user')) {
        setWaitingForUser(true);
        setCurrentSpeaker(nextSpeaker);
      } else if (shouldPauseAfter) {
        setWaitingForContinue(true);
        setCurrentSpeaker(nextSpeaker);
      } else {
        setCurrentSpeaker(nextSpeaker);
      }
      
      return responseMessage;
    } catch (error) {
      console.error('Error generating response:', error);
      toast({
        title: "Error",
        description: "Failed to generate response",
        variant: "destructive"
      });
      return null;
    }
   };
 
  const continueRound = async () => {
    setWaitingForContinue(false);
    
    // When both participants are AI figures, generate and play videos sequentially
    if (hostType === 'figure' && guestType === 'figure') {
      // Always start with host, then guest for each round
      const firstSpeaker: 'host' | 'guest' = 'host';
      const secondSpeaker: 'host' | 'guest' = 'guest';
      
      const firstFigure = host;
      const secondFigure = guest;
      
      if (!firstFigure || !secondFigure || !podcastSessionId) return;

      console.log(`🎙️ Starting round ${currentRound + 1}`);

      // Generate first speaker's content (host)
      const { data: firstData, error: firstError } = await supabase.functions.invoke('podcast-orchestrator', {
        body: { sessionId: podcastSessionId, language: selectedLanguage.split('-')[0] }
      });
      
      if (firstError || !firstData) {
        console.error('Failed to get first response:', firstError);
        setWaitingForContinue(true);
        return;
      }
      
      const firstMessage: Message = {
        id: Date.now().toString(),
        content: firstData.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: firstFigure.name
      };
      setMessages(prev => [...prev, firstMessage]);
      setSpeakerCount(prev => prev + 1);
      
      // Generate and play first audio (host)
      if (isAutoVoiceEnabled) {
        console.log(`🎤 Generating audio for ${firstFigure.name}`);
        setCurrentVideoSpeaker(firstSpeaker);
        await generateAndPlayAudio(firstData.message, firstFigure.name, firstFigure.id, firstSpeaker);
      }

      // Generate second speaker's content (guest)
      const { data: secondData, error: secondError } = await supabase.functions.invoke('podcast-orchestrator', {
        body: { sessionId: podcastSessionId, language: selectedLanguage.split('-')[0] }
      });
      
      if (secondError || !secondData) {
        console.error('Failed to get second response:', secondError);
        setWaitingForContinue(true);
        return;
      }
      
      const secondMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: secondData.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: secondFigure.name
      };
      setMessages(prev => [...prev, secondMessage]);
      setSpeakerCount(prev => prev + 1);
      
      // Generate and play second audio (guest)
      if (isAutoVoiceEnabled) {
        console.log(`🎤 Generating audio for ${secondFigure.name}`);
        setCurrentVideoSpeaker(secondSpeaker);
        await generateAndPlayAudio(secondData.message, secondFigure.name, secondFigure.id, secondSpeaker);
      }
      
      // Update round and prepare for next
      setCurrentRound(prev => prev + 1);
      setCurrentVideoSpeaker(null);
      setCurrentSpeaker('host'); // Reset to host for next round
      setWaitingForContinue(true);
      console.log(`✅ Round complete, ready for next round`);
    } else {
      // If a user is involved, just continue normally
      await continueConversation(currentSpeaker, true);
    }
  };
  
  // Generate audio only - video generation disabled (Ditto removed)
  const generateAudioOnly = async (
    text: string,
    figureName: string,
    figureId: string,
    speaker: 'host' | 'guest'
  ): Promise<string | null> => {
    try {
      console.log('🎤 Generating audio for:', figureName);
      
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text: text,
          figure_name: figureName,
          figure_id: figureId,
          voice: speaker === 'host' ? hostVoice : guestVoice,
          language: selectedLanguage,
          is_user_host: false
        }
      });

      if (error || !data?.audioContent) return null;

      return `data:audio/mpeg;base64,${data.audioContent}`;
    } catch (error) {
      console.error('Error generating audio:', error);
      return null;
    }
  };
 
  // Generate TTS and play audio with static avatar (video generation disabled)
  const generateAndPlayAudio = async (
    text: string, 
    figureName: string, 
    figureId: string,
    speaker: 'host' | 'guest'
  ): Promise<void> => {
    try {
      setIsGeneratingVideo(true);
      setCurrentVideoSpeaker(speaker);
      console.log('🎤 Generating TTS for:', figureName);
      
      // Generate TTS audio
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text: text,
          figure_name: figureName,
          figure_id: figureId,
          voice: speaker === 'host' ? hostVoice : guestVoice,
          language: selectedLanguage,
          is_user_host: hostType === 'user' && figureId === 'user-host'
        }
      });

      if (error) throw error;
      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      const audioDataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      setIsGeneratingVideo(false);

      console.log('✅ Audio ready, playing...');
      
      // Play audio (video generation disabled - using static avatars)
      await playAudio(audioDataUrl);
      
    } catch (error) {
      console.error('Error generating audio:', error);
      setIsGeneratingVideo(false);
    }
  };

  // Play audio with promise
  const playAudio = (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  };

  // Play video and wait for it to complete
  const playVideo = (videoUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsPlayingVideo(true);
      setIsPaused(false);
      setIsStopped(false);
      
      // Create a temporary video element to track completion
      const checkVideoEnd = () => {
        const videoEl = document.querySelector('video[src="' + videoUrl + '"]') as HTMLVideoElement;
        if (videoEl) {
          currentVideoRef.current = videoEl;
          
          const handleEnded = () => {
            console.log('✅ Video finished playing');
            setIsPlayingVideo(false);
            currentVideoRef.current = null;
            videoEl.removeEventListener('ended', handleEnded);
            resolve();
          };
          
          videoEl.addEventListener('ended', handleEnded);
          
          // Also check if video already ended or errors
          if (videoEl.ended) {
            handleEnded();
          }
          
          videoEl.onerror = () => {
            console.log('⚠️ Video error');
            setIsPlayingVideo(false);
            currentVideoRef.current = null;
            resolve();
          };
        } else {
          // Video element not found yet, wait a bit and try again
          setTimeout(checkVideoEnd, 100);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkVideoEnd, 200);
      
      // Safety timeout - max 2 minutes
      setTimeout(() => {
        setIsPlayingVideo(false);
        resolve();
      }, 120000);
    });
  };


  const toggleAutoVoice = () => {
    setIsAutoVoiceEnabled(!isAutoVoiceEnabled);
    toast({
      title: isAutoVoiceEnabled ? "Auto-voice disabled" : "Auto-voice enabled",
      description: isAutoVoiceEnabled 
        ? "Audio responses are now off" 
        : "Audio responses are now on",
    });
  };

  const handleUserSubmit = async () => {
    if (!userInput.trim()) {
      toast({
        title: "Empty message",
        description: "Please type your message",
        variant: "destructive"
      });
      return;
    }

    const speakerName = currentSpeaker === 'host' 
      ? (hostType === 'user' ? 'You (Host)' : host?.name)
      : (guestType === 'user' ? 'You (Guest)' : guest?.name);

    const newMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      type: "user",
      timestamp: new Date(),
      speakerName: speakerName
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Save user's message to database
    if (podcastSessionId) {
      await supabase.from('podcast_messages').insert({
        podcast_session_id: podcastSessionId,
        turn_number: speakerCount,
        figure_id: 'user',
        figure_name: speakerName,
        speaker_role: currentSpeaker,
        content: userInput,
      });
    }
    
    setUserInput("");
    setWaitingForUser(false);
    
    // Increment speaker count and round after both speakers have spoken
    setSpeakerCount(prevCount => {
      const newCount = prevCount + 1;
      if (newCount % 2 === 0) {
        setCurrentRound(prevRound => prevRound + 1);
      }
      return newCount;
    });

    // Set up next turn - switch to the AI speaker
    const nextSpeaker = currentSpeaker === 'host' ? 'guest' : 'host';
    setCurrentSpeaker(nextSpeaker);
    
    // Wait for Continue button since user just spoke
    setWaitingForContinue(true);
    if ((nextSpeaker === 'host' && hostType === 'user') || (nextSpeaker === 'guest' && guestType === 'user')) {
      setWaitingForUser(true);
      setCurrentSpeaker(nextSpeaker);
    } else {
      setWaitingForContinue(true);
      setCurrentSpeaker(nextSpeaker);
    }
  };

  if (selectingFor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Select {selectingFor === 'host' ? 'Podcast Host' : 'Guest'}
          </h2>
          <Button variant="outline" onClick={() => setSelectingFor(null)}>
            Cancel
          </Button>
        </div>
        <HistoricalFigureSearch 
          selectedFigure={null} 
          onSelectFigure={handleFigureSelect} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Podcast Mode</h2>
        </div>

        {/* Figure Selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Host</label>
            <Select 
              value={hostType} 
              onValueChange={(value: 'user' | 'figure') => {
                setHostType(value);
                if (value === 'user' && guestType === 'user') {
                  setGuestType('figure');
                }
              }}
              disabled={isRecording}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="user">👤 You (User)</SelectItem>
                <SelectItem value="figure">🎭 Historical Figure</SelectItem>
              </SelectContent>
            </Select>
            {hostType === 'figure' && (
              host ? (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{host.name}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelectingFor('host')}>
                    Change
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setSelectingFor('host')} variant="outline" className="w-full">
                  Select Figure
                </Button>
              )
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Guest</label>
            <Select 
              value={guestType} 
              onValueChange={(value: 'user' | 'figure') => {
                setGuestType(value);
                if (value === 'user' && hostType === 'user') {
                  setHostType('figure');
                }
              }}
              disabled={isRecording}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="user">👤 You (User)</SelectItem>
                <SelectItem value="figure">🎭 Historical Figure</SelectItem>
              </SelectContent>
            </Select>
            {guestType === 'figure' && (
              guest ? (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{guest.name}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelectingFor('guest')}>
                    Change
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setSelectingFor('guest')} variant="outline" className="w-full">
                  Select Figure
                </Button>
              )
            )}
          </div>
        </div>

        {/* Topic Input */}
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Podcast Topic</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={podcastTopic}
              onChange={(e) => setPodcastTopic(e.target.value)}
              placeholder="What should they discuss?"
              className="flex-1 p-3 border rounded-lg"
              disabled={isRecording}
            />
            <Button
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={toggleListening}
              disabled={isRecording}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          {recordingTranscript && (
            <p className="text-sm text-muted-foreground italic">
              Listening: {recordingTranscript}
            </p>
          )}
        </div>

        {/* Language Selection */}
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-3 flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            Response Language
          </h3>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecording}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50 max-h-[300px]">
              <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
              <SelectItem value="es-ES">🇪🇸 Español (Spanish)</SelectItem>
              <SelectItem value="fr-FR">🇫🇷 Français (French)</SelectItem>
              <SelectItem value="de-DE">🇩🇪 Deutsch (German)</SelectItem>
              <SelectItem value="it-IT">🇮🇹 Italiano (Italian)</SelectItem>
              <SelectItem value="pt-PT">🇵🇹 Português (Portuguese)</SelectItem>
              <SelectItem value="ja-JP">🇯🇵 日本語 (Japanese)</SelectItem>
              <SelectItem value="zh-CN">🇨🇳 中文 (Chinese)</SelectItem>
              <SelectItem value="ko-KR">🇰🇷 한국어 (Korean)</SelectItem>
              <SelectItem value="ar-SA">🇸🇦 العربية (Arabic)</SelectItem>
              <SelectItem value="ru-RU">🇷🇺 Русский (Russian)</SelectItem>
              <SelectItem value="hi-IN">🇮🇳 हिन्दी (Hindi)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Figures will respond in this language
          </p>
        </Card>

        {/* Controls */}
        <div className="flex gap-2 mb-6">

          <Button
            variant={isAutoVoiceEnabled ? "default" : "outline"}
            size="icon"
            onClick={toggleAutoVoice}
            title={isAutoVoiceEnabled ? "Disable auto-voice" : "Enable auto-voice"}
          >
            {isAutoVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {!isRecording ? (
            <Button onClick={startPodcast} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              Start Podcast
            </Button>
          ) : (
            <Button onClick={stopPodcast} variant="destructive" className="flex-1">
              <Square className="mr-2 h-4 w-4" />
              Stop Podcast
            </Button>
          )}
        </div>

        {/* Video Loading Indicator */}
        {(isGeneratingVideo || isPreloading) && (
          <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-primary/10 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">
              {isPreloading ? 'Preparing next speaker...' : 'Creating video... This may take 30-60 seconds'}
            </span>
          </div>
        )}

        {/* Avatars */}
        {(host || guest) && (
          <div className={hostType === 'user' ? "flex justify-center mb-6" : "grid grid-cols-2 gap-4 mb-6"}>
            {host && hostType !== 'user' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">{host.name}</p>
                <p className="text-xs text-muted-foreground text-center">Host</p>
                <RealisticAvatar
                  imageUrl={hostAvatarUrl}
                  isLoading={isLoadingHostAvatar}
                  videoUrl={hostVideoUrl}
                  isGeneratingVideo={isGeneratingVideo && currentVideoSpeaker === 'host'}
                  figureName={host.name}
                  figureId={host.id}
                />
                <Select
                  value={hostVoice}
                  onValueChange={(value) => setHostVoice(value)}
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-background z-50">
                    <SelectValue placeholder="Auto voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="auto" className="text-xs">Auto voice</SelectItem>
                    {azureVoices[detectGender(host.name)].map((voice) => (
                      <SelectItem key={voice.value} value={voice.value} className="text-xs">
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {guest && (
              <div className={`space-y-2 ${hostType === 'user' ? 'max-w-md w-full' : ''}`}>
                <p className="text-sm font-medium text-center">{guest.name}</p>
                <p className="text-xs text-muted-foreground text-center">Guest</p>
                <RealisticAvatar
                  imageUrl={guestAvatarUrl}
                  isLoading={isLoadingGuestAvatar}
                  videoUrl={guestVideoUrl}
                  isGeneratingVideo={isGeneratingVideo && currentVideoSpeaker === 'guest'}
                  figureName={guest.name}
                  figureId={guest.id}
                />
                <Select
                  value={guestVoice}
                  onValueChange={(value) => setGuestVoice(value)}
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-background z-50">
                    <SelectValue placeholder="Auto voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="auto" className="text-xs">Auto voice</SelectItem>
                    {azureVoices[detectGender(guest.name)].map((voice) => (
                      <SelectItem key={voice.value} value={voice.value} className="text-xs">
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Messages */}
      {messages.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Conversation</h3>
          <ChatMessages 
            messages={messages} 
            selectedFigure={host || guest} 
            isLoading={false}
          />
        </Card>
      )}


      {/* Continue Button - Only for AI host + AI guest mode */}
      {isRecording && waitingForContinue && hostType === 'figure' && guestType === 'figure' && (
        <Button 
          onClick={continueRound}
          className="w-full mb-4"
          size="lg"
        >
          Continue Conversation (Round {currentRound})
        </Button>
      )}

      {/* Input Ribbon - Only show when podcast is recording */}
      {isRecording && (
        <Card className="border-t border-border bg-card p-4">
          {waitingForUser ? (
            <div className="space-y-3">
              <div className="text-center py-2 bg-primary/10 rounded-lg">
                <p className="font-semibold text-primary">
                  🎤 Your Turn! ({currentSpeaker === 'host' ? 'Host' : 'Guest'})
                </p>
                <p className="text-xs text-muted-foreground mt-1">Record or type your response</p>
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your message here..."
                    className="min-h-[60px] resize-none pr-12"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleUserSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={toggleListening}
                    variant="ghost"
                    size="sm"
                    className={`absolute right-2 top-2 h-8 w-8 ${
                      isListening 
                        ? 'text-red-500 animate-pulse bg-red-50 dark:bg-red-950' 
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                <Button 
                  onClick={handleUserSubmit}
                  size="icon"
                  className="h-[60px] w-[60px]"
                  disabled={!userInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  value={recordingTranscript}
                  onChange={(e) => setRecordingTranscript(e.target.value)}
                  placeholder="Ask a question or join the conversation..."
                  className="min-h-[60px] resize-none pr-12"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (recordingTranscript.trim()) {
                        const userMessage: Message = {
                          id: Date.now().toString(),
                          content: recordingTranscript,
                          type: "user",
                          timestamp: new Date(),
                          speakerName: "You"
                        };
                        setMessages(prev => [...prev, userMessage]);
                        const question = recordingTranscript;
                        setRecordingTranscript("");
                        handleUserQuestion(question);
                      }
                    }
                  }}
                />
                <Button
                  onClick={toggleListening}
                  variant="ghost"
                  size="sm"
                  className={`absolute right-2 top-2 h-8 w-8 ${
                    isListening 
                      ? 'text-red-500 animate-pulse bg-red-50 dark:bg-red-950' 
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                {isPlayingVideo && (
                  <>
                    <Button 
                      onClick={handlePauseVideo}
                      size="icon"
                      variant="secondary"
                      className="h-[60px] w-[60px]"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={stopPodcast}
                      size="icon"
                      variant="destructive"
                      className="h-[60px] w-[60px]"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {(isPaused || isStopped) && (
                  <>
                    <Button 
                      onClick={isStopped ? handleReplayVideo : handleResumeVideo}
                      size="icon"
                      variant="default"
                      className="h-[60px] w-[60px]"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={handleReplayVideo}
                      size="icon"
                      variant="outline"
                      className="h-[60px] w-[60px]"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button 
                  onClick={() => {
                    // Send user question to interrupt conversation
                    if (recordingTranscript.trim()) {
                      const userMessage: Message = {
                        id: Date.now().toString(),
                        content: recordingTranscript,
                        type: "user",
                        timestamp: new Date(),
                        speakerName: "You"
                      };
                      setMessages(prev => [...prev, userMessage]);
                      const question = recordingTranscript;
                      setRecordingTranscript("");
                      
                      // Handle as user question (interrupts normal flow)
                      handleUserQuestion(question);
                    }
                  }}
                  disabled={!recordingTranscript.trim()}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default PodcastMode;
