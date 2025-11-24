import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Play, Square, Mic, MicOff, Globe, Volume2, VolumeX, Pause, RotateCcw, Send } from "lucide-react";
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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [hostVoice, setHostVoice] = useState<string>('auto');
  const [guestVoice, setGuestVoice] = useState<string>('auto');
  
  // Avatar state
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);
  const [guestAvatarUrl, setGuestAvatarUrl] = useState<string | null>(null);
  const [isLoadingHostAvatar, setIsLoadingHostAvatar] = useState(false);
  const [isLoadingGuestAvatar, setIsLoadingGuestAvatar] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isProcessingAudioRef = useRef(false);
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
      const hostName = hostType === 'user' ? 'User Host' : host!.name;
      const guestId = guestType === 'user' ? 'user-guest' : guest!.id;
      const guestName = guestType === 'user' ? 'User Guest' : guest!.name;

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

      // Generate first round (host intro + guest response)
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
      
      // Generate and play audio for host
      if (isAutoVoiceEnabled && hostType === 'figure') {
        generateAndPlayAudio(firstResponse.message, hostName, hostId);
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

      // Generate and play audio for guest
      if (isAutoVoiceEnabled && guestType === 'figure') {
        generateAndPlayAudio(secondResponse.message, guestName, guestId);
      }

      toast({
        title: "Podcast started!",
        description: `${hostName} and ${guestName} are discussing "${podcastTopic}"`,
      });

      // Set up for next round
      if (hostType === 'figure' && guestType === 'figure') {
        setWaitingForContinue(true);
      } else {
        setWaitingForUser(true);
        setCurrentSpeaker(hostType === 'user' ? 'host' : 'guest');
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
    // Don't set isRecording to false - keep ribbon visible
    setCurrentSpeaker('host');
    
    // Stop any playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    setIsPlayingAudio(false);
    setIsPaused(false);
    setIsStopped(true);
    setCurrentAudio(null);
    
    // Clear audio queue
    audioQueueRef.current = [];
    isProcessingAudioRef.current = false;
    
    toast({
      title: "Podcast stopped",
      description: "Click Play to restart the audio",
    });
  };

  const handlePauseAudio = () => {
    if (currentAudio && isPlayingAudio) {
      currentAudio.pause();
      setIsPlayingAudio(false);
      setIsPaused(true);
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
      setIsPaused(true);
    }
    
    toast({
      title: "Paused",
      description: "Audio playback has been paused",
      duration: 2000,
    });
  };

  const handleResumeAudio = () => {
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
    }
    
    if (audioElementRef.current && isPaused) {
      audioElementRef.current.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
    }
    
    toast({
      title: "Resumed",
      description: "Audio playback resumed",
      duration: 2000,
    });
  };

  const handleReplayAudio = () => {
    // Replay the current audio from the beginning
    if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
      setIsStopped(false);
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
      audioElementRef.current.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
      setIsStopped(false);
    }
    
    toast({
      title: "Replaying",
      description: "Audio replaying from start",
      duration: 2000,
    });
  };

  const handleUserQuestion = async (questionContent: string) => {
    if (!podcastSessionId || !host || !guest) {
      console.error('Missing session data');
      return;
    }

    console.log('🚨 USER QUESTION MODE ACTIVATED - Interrupting normal flow');
    
    // Set flag to prevent any in-flight normal turns from processing
    setIsProcessingUserQuestion(true);

    // Interrupt: Stop current audio and clear queue
    stopPodcast();

    // Save user message to database
    const { error: userMsgError } = await supabase
      .from('podcast_messages')
      .insert({
        podcast_session_id: podcastSessionId,
        turn_number: -1, // User messages don't follow turn order
        figure_id: 'user',
        figure_name: 'User',
        speaker_role: 'user',
        content: questionContent,
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      toast({
        title: "Error",
        description: "Failed to save your question",
        variant: "destructive"
      });
      return;
    }

    console.log('👤 User asked question, generating responses...');

    try {
      // Host responds to user's question
      const { data: hostData, error: hostError } = await supabase.functions.invoke('podcast-orchestrator', {
        body: {
          sessionId: podcastSessionId,
          language: selectedLanguage.split('-')[0],
          userQuestion: true,
          forceSpeaker: 'host'
        }
      });

      if (hostError) throw hostError;

      const hostMessage: Message = {
        id: Date.now().toString(),
        content: hostData.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: host.name
      };

      setMessages(prev => [...prev, hostMessage]);

      if (isAutoVoiceEnabled) {
        generateAndPlayAudio(hostData.message, host.name, host.id);
      }

      // Guest responds to user's question + host's answer
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
        id: Date.now().toString() + '1',
        content: guestData.message,
        type: "assistant",
        timestamp: new Date(),
        speakerName: guest.name
      };

      setMessages(prev => [...prev, guestMessage]);

      if (isAutoVoiceEnabled) {
        generateAndPlayAudio(guestData.message, guest.name, guest.id);
      }

      setWaitingForContinue(true);
      
      console.log('✅ USER QUESTION MODE COMPLETE');

    } catch (error) {
      console.error('Error handling user question:', error);
      toast({
        title: "Error",
        description: "Failed to generate responses to your question",
        variant: "destructive"
      });
    } finally {
      // Clear user question mode flag
      setIsProcessingUserQuestion(false);
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

      // Generate and play audio - use figure from state (not orchestrator response)
      if (isAutoVoiceEnabled) {
        const figureName = currentFigure.name;  // Use actual figure name from state
        const figureId = currentFigure.id;      // Use actual figure ID from state
        console.log(`🎤 Generating TTS for ${figureName} (${figureId})`);
        generateAndPlayAudio(data.message, figureName, figureId);
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
     
     // When both participants are AI figures, each round should include both speaking
     if (hostType === 'figure' && guestType === 'figure') {
       const firstSpeaker: 'host' | 'guest' = currentSpeaker;
       const secondSpeaker: 'host' | 'guest' = currentSpeaker === 'host' ? 'guest' : 'host';
 
       // First speaker generates response
       const firstResponse = await continueConversation(firstSpeaker, false);
       
       // Second speaker generates response
       if (firstResponse) {
         await continueConversation(secondSpeaker, true);
       }
     } else {
       // If a user is involved, keep single-turn behavior
       await continueConversation(currentSpeaker, true);
     }
   };
 
   const processAudioQueue = async () => {
    if (isProcessingAudioRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isProcessingAudioRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioTask = audioQueueRef.current.shift();
      if (audioTask) {
        await audioTask();
        // Wait 1 second before playing the next audio
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    isProcessingAudioRef.current = false;
  };

  const generateAndPlayAudio = async (text: string, figureName: string, figureId: string): Promise<void> => {
    const audioTask = () => new Promise<void>(async (resolve) => {
      try {
        setIsSpeaking(true);
        
        console.log('🎤 Generating Azure TTS for:', figureName, '(ID:', figureId, ') with language:', selectedLanguage);
        
        const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
          body: {
            text: text,
            figure_name: figureName,
            figure_id: figureId,
            voice: figureId === host?.id ? hostVoice : guestVoice,
            language: selectedLanguage
          }
        });

        if (error) throw error;

        if (data?.audioContent) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
            { type: 'audio/mpeg' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          setCurrentAudioUrl(audioUrl);
          await playAudio(audioUrl);
          resolve();
        } else {
          resolve();
        }
      } catch (error) {
        console.error('Error generating audio:', error);
        setIsSpeaking(false);
        resolve();
      }
    });

    // Add to queue and process
    audioQueueRef.current.push(audioTask);
    processAudioQueue();
  };

  const playAudio = (url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.remove();
      }

      const audio = new Audio(url);
      audioElementRef.current = audio;
      setCurrentAudio(audio);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (!sourceNodeRef.current && audioContextRef.current) {
        const source = audioContextRef.current.createMediaElementSource(audio);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);
        
        sourceNodeRef.current = source;
        analyserRef.current = analyser;
      }

      audio.onplay = () => {
        console.log('▶️ Audio started playing');
        setIsPlayingAudio(true);
        setIsPaused(false);
      };

      audio.onended = () => {
        console.log('✅ Audio finished');
        setIsPlayingAudio(false);
        setIsPaused(false);
        setIsSpeaking(false);
        setCurrentAudioUrl(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setIsPaused(false);
        setIsSpeaking(false);
        setCurrentAudioUrl(null);
        setCurrentAudio(null);
        resolve();
      };

      setIsPlayingAudio(true);
      audio.play().catch(error => {
        console.error('Audio playback failed:', error);
        setIsPlayingAudio(false);
        setIsPaused(false);
        setIsSpeaking(false);
        resolve();
      });
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

    // Set up next turn - the other speaker
    const nextSpeaker = currentSpeaker === 'host' ? 'guest' : 'host';
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
                  audioUrl={currentSpeaker === 'host' ? currentAudioUrl : null}
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
                  audioUrl={currentSpeaker === 'guest' ? currentAudioUrl : null}
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


      {/* Continue Button - Show when waiting for next exchange */}
      {isRecording && waitingForContinue && (
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
              {isPlayingAudio ? (
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePauseAudio}
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
                </div>
              ) : isPaused || isStopped ? (
                <div className="flex gap-2">
                  <Button 
                    onClick={isStopped ? handleReplayAudio : handleResumeAudio}
                    size="icon"
                    variant="default"
                    className="h-[60px] w-[60px]"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={handleReplayAudio}
                    size="icon"
                    variant="outline"
                    className="h-[60px] w-[60px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => {
                    // Send user message to join conversation
                    if (recordingTranscript.trim()) {
                      const userMessage: Message = {
                        id: Date.now().toString(),
                        content: recordingTranscript,
                        type: "user",
                        timestamp: new Date(),
                        speakerName: "You"
                      };
                      setMessages(prev => [...prev, userMessage]);
                      setRecordingTranscript("");
                      
                      // Continue podcast conversation
                      continueConversation(currentSpeaker);
                    }
                  }}
                  disabled={!recordingTranscript.trim()}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default PodcastMode;
