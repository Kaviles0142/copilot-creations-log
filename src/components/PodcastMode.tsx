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
  
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'host' | 'guest'>('host');
  const [podcastTopic, setPodcastTopic] = useState("");
  
  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  
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
  
  const { toast } = useToast();

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
    if (!host || !guest || !podcastTopic.trim()) {
      toast({
        title: "Missing information",
        description: "Please select both host and guest, and provide a topic.",
        variant: "destructive"
      });
      return;
    }

    setIsRecording(true);
    
    // Get AI-generated introduction in the correct language
    try {
      const { data, error } = await supabase.functions.invoke('chat-with-historical-figure', {
        body: {
          message: `You are ${host.name}, the podcast host. Begin by introducing yourself briefly, then welcome your guest ${guest.name}, and introduce today's topic: "${podcastTopic}". Make it engaging and conversational.`,
          figure: {
            id: host.id,
            name: host.name,
            period: host.period,
            description: host.description
          },
          language: selectedLanguage.split('-')[0],
          conversationType: 'casual'
        }
      });

      if (error) throw error;

      const introMessage = data.response;
      
      const newMessage: Message = {
        id: Date.now().toString(),
        content: introMessage,
        type: "assistant",
        timestamp: new Date(),
        speakerName: host.name
      };
      
      setMessages([newMessage]);
      setCurrentSpeaker('host');
      
      // Generate and play audio (don't await so next response can be generated in parallel)
      if (isAutoVoiceEnabled) {
        generateAndPlayAudio(introMessage, host.name, host.id);
      }
      
      toast({
        title: "Podcast started!",
        description: `${host.name} and ${guest.name} are ready to discuss "${podcastTopic}"`,
      });

      // Get guest's response immediately (will start generating while host audio plays)
      setTimeout(() => {
        continueConversation('guest');
      }, 500);
    } catch (error) {
      console.error('Error starting podcast:', error);
      toast({
        title: "Error",
        description: "Failed to start podcast. Please try again.",
        variant: "destructive"
      });
      setIsRecording(false);
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

  const continueConversation = async (speaker: 'host' | 'guest') => {
    const currentFigure = speaker === 'host' ? host : guest;
    const otherFigure = speaker === 'host' ? guest : host;
    
    if (!currentFigure || !otherFigure) return;

    setCurrentSpeaker(speaker);

    try {
      // Simple message to let the edge function handle the conversation flow
      const recentContext = messages.slice(-2).map(m => `${m.speakerName}: ${m.content}`).join('\n');
      
      const prompt = speaker === 'host'
        ? `As the podcast host, continue the conversation about "${podcastTopic}" with your guest ${otherFigure.name}. Ask an engaging question or respond to their comments. Recent: ${recentContext}`
        : `You are ${currentFigure.name}, the podcast guest. Respond to the host ${otherFigure.name}'s introduction and comments about "${podcastTopic}". Be conversational and engaging. Recent: ${recentContext}`;

      // Get AI response from the current speaker
      const { data, error } = await supabase.functions.invoke('chat-with-historical-figure', {
        body: {
          message: prompt,
          figure: {
            id: currentFigure.id,
            name: currentFigure.name,
            period: currentFigure.period,
            description: currentFigure.description
          },
          language: selectedLanguage.split('-')[0],
          conversationType: 'casual'
        }
      });

      if (error) throw error;

      const responseMessage: Message = {
        id: Date.now().toString(),
        content: data.response,
        type: "assistant",
        timestamp: new Date(),
        speakerName: currentFigure.name
      };

      setMessages(prev => [...prev, responseMessage]);

      // Generate and play audio (don't await so next response generates while audio plays)
      if (isAutoVoiceEnabled) {
        generateAndPlayAudio(data.response, currentFigure.name, currentFigure.id);
      }
      
      // Continue with other speaker immediately (response generates while current audio plays)
      if (isRecording && messages.length < 10) {
        setTimeout(() => {
          continueConversation(speaker === 'host' ? 'guest' : 'host');
        }, 500);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      toast({
        title: "Error",
        description: "Failed to generate response",
        variant: "destructive"
      });
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
        // Wait 2 seconds before playing the next audio
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    isProcessingAudioRef.current = false;
  };

  const generateAndPlayAudio = async (text: string, figureName: string, figureId: string): Promise<void> => {
    const audioTask = () => new Promise<void>(async (resolve) => {
      try {
        setIsSpeaking(true);
        
        console.log('🎤 Generating Azure TTS for:', figureName, 'with language:', selectedLanguage);
        
        const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
          body: {
            text: text,
            figure_name: figureName,
            figure_id: figureId,
            voice: 'auto',
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
            {host ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>{host.name}</span>
                <Button size="sm" variant="outline" onClick={() => setSelectingFor('host')}>
                  Change
                </Button>
              </div>
            ) : (
              <Button onClick={() => setSelectingFor('host')} variant="outline" className="w-full">
                Select Host
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Guest</label>
            {guest ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>{guest.name}</span>
                <Button size="sm" variant="outline" onClick={() => setSelectingFor('guest')}>
                  Change
                </Button>
              </div>
            ) : (
              <Button onClick={() => setSelectingFor('guest')} variant="outline" className="w-full">
                Select Guest
              </Button>
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
          <div className="grid grid-cols-2 gap-4 mb-6">
            {host && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">{host.name}</p>
                <RealisticAvatar
                  imageUrl={hostAvatarUrl}
                  isLoading={isLoadingHostAvatar}
                  audioUrl={currentSpeaker === 'host' ? currentAudioUrl : null}
                />
              </div>
            )}
            {guest && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">{guest.name}</p>
                <RealisticAvatar
                  imageUrl={guestAvatarUrl}
                  isLoading={isLoadingGuestAvatar}
                  audioUrl={currentSpeaker === 'guest' ? currentAudioUrl : null}
                />
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

      {/* Input Ribbon - Only show when podcast is recording */}
      {isRecording && (
        <Card className="border-t border-border bg-card p-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Textarea
                value={recordingTranscript}
                onChange={(e) => setRecordingTranscript(e.target.value)}
                placeholder="Join the conversation... (or click the mic to speak)"
                className="min-h-[60px] resize-none pr-12"
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
        </Card>
      )}
    </div>
  );
};

export default PodcastMode;
