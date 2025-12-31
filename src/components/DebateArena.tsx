import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import StreamingAvatar from "./StreamingAvatar";
import RealisticAvatar from "./RealisticAvatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Volume2, VolumeX, Pause, Play, RotateCcw, Square, Mic, MicOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChunkedVideoGeneration } from "@/hooks/useChunkedVideoGeneration";

interface Figure {
  id: string;
  name: string;
}

type DebateFormat = "round-robin" | "free-for-all" | "moderated";

interface DebateMessage {
  id: string;
  figure_id: string;
  figure_name: string;
  content: string;
  turn_number: number;
  is_user_message: boolean;
  created_at: string;
}

interface DebateArenaProps {
  sessionId: string;
  topic: string;
  figures: Figure[];
  format: DebateFormat;
  language: string;
  onEnd: () => void;
}

// Audio queue system to prevent interruption
interface AudioQueueItem {
  text: string;
  figureName: string;
  figureId: string;
}

// Helper function to capitalize names properly
const capitalizeName = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function DebateArena({ sessionId, topic, figures, format, language, onEnd }: DebateArenaProps) {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [recordingTranscript, setRecordingTranscript] = useState("");
  const [isStopped, setIsStopped] = useState(false);
  const [selectedVoices, setSelectedVoices] = useState<Record<string, string>>({});
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [speakingFigureId, setSpeakingFigureId] = useState<string | null>(null);
  const [speakingFigureName, setSpeakingFigureName] = useState<string | null>(null);
  
  // Chunked video state
  const [allVideoUrls, setAllVideoUrls] = useState<string[]>([]);
  const [isLoadingNextChunk, setIsLoadingNextChunk] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioEnabledRef = useRef(true);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  
  // Chunked video generation hook
  const chunkedVideo = useChunkedVideoGeneration();

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
    return femaleNames.some(n => nameLower.includes(n)) ? 'female' : 'male';
  };
  
  // Auto-select Australian English for Elon Musk
  useEffect(() => {
    const elonFigure = figures.find(f => 
      f.id === 'elon-musk' || f.name.toLowerCase().includes('elon musk')
    );
    
    if (elonFigure && !selectedVoices[elonFigure.id]) {
      const elonGender = detectGender(elonFigure.name);
      const australianVoice = azureVoices[elonGender].find(v => v.value.includes('en-AU'))?.value;
      
      if (australianVoice) {
        setSelectedVoices(prev => ({
          ...prev,
          [elonFigure.id]: australianVoice
        }));
        console.log('🎙️ Auto-selected Australian English for Elon Musk');
      }
    }
  }, [figures]);

  // Sync audioEnabled state with ref
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = language || 'en-US';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        console.log('Voice recognition started');
      };
      
      recognitionInstance.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setUserInput(prev => prev + finalTranscript);
          setRecordingTranscript('');
        } else {
          setRecordingTranscript(interimTranscript);
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Voice recognition error",
          description: event.error,
          variant: "destructive",
        });
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
        console.log('Voice recognition ended');
      };
      
      setRecognition(recognitionInstance);
    }
  }, [language]);

  useEffect(() => {
    loadMessages();
    loadAvatars();
    const cleanup = subscribeToMessages();
    return cleanup; // Return cleanup function to properly unsubscribe
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("debate_messages")
      .select("*")
      .eq("debate_session_id", sessionId)
      .order("turn_number", { ascending: true });

    if (data) {
      setMessages(data);
      
      // Add AI messages to audio queue if audio is enabled
      if (audioEnabledRef.current) {
        data.forEach(msg => {
          if (!msg.is_user_message) {
            console.log('➕ Adding existing message to audio queue:', msg.figure_name);
            addToAudioQueue(msg.content, msg.figure_name, msg.figure_id);
          }
        });
      }
    }

    // Load session state
    const { data: session } = await supabase
      .from("debate_sessions")
      .select("current_round, is_round_complete")
      .eq("id", sessionId)
      .single();

    if (session) {
      setCurrentRound(session.current_round);
      setIsRoundComplete(session.is_round_complete);
    }
  };

  const loadAvatars = async () => {
    console.log('🎭 Loading avatars for debate participants...');
    setLoadingAvatars(true);
    
    const avatarPromises = figures.map(async (figure) => {
      try {
        // Check cache first
        const { data: cached } = await supabase
          .from('avatar_image_cache')
          .select('cloudinary_url')
          .eq('figure_id', figure.id)
          .maybeSingle();

        if (cached?.cloudinary_url) {
          console.log(`✅ Found cached avatar for ${figure.name}`);
          return { figureId: figure.id, url: cached.cloudinary_url };
        }

        // Generate new avatar
        console.log(`📸 Generating avatar for ${figure.name}...`);
        const { data, error } = await supabase.functions.invoke('generate-avatar-portrait', {
          body: {
            figureName: figure.name,
            figureId: figure.id
          }
        });

        if (error) throw error;

        return { figureId: figure.id, url: data.imageUrl };
      } catch (error) {
        console.error(`❌ Failed to load avatar for ${figure.name}:`, error);
        return { figureId: figure.id, url: '' };
      }
    });

    const results = await Promise.all(avatarPromises);
    const avatarMap = results.reduce((acc, { figureId, url }) => {
      acc[figureId] = url;
      return acc;
    }, {} as Record<string, string>);

    setAvatarUrls(avatarMap);
    setLoadingAvatars(false);
    console.log('🎭 All avatars loaded');
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`debate-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "debate_messages",
          filter: `debate_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const newMessage = payload.new as DebateMessage;
          
          console.log('📩 New debate message received:', newMessage.figure_name, 'Turn:', newMessage.turn_number);
          
          // Add message to display immediately
          setMessages((prev) => [...prev, newMessage]);
          
          if (!newMessage.is_user_message) {
            // Add audio to queue if enabled (using ref to avoid closure)
            console.log('🔊 Audio enabled:', audioEnabledRef.current);
            if (audioEnabledRef.current) {
              console.log('➕ Adding to audio queue:', newMessage.figure_name);
              addToAudioQueue(newMessage.content, newMessage.figure_name, newMessage.figure_id);
            }

            // Check if round is complete after this message
            setTimeout(async () => {
              const { data: session } = await supabase
                .from("debate_sessions")
                .select("is_round_complete")
                .eq("id", sessionId)
                .single();

              if (session?.is_round_complete) {
                setIsRoundComplete(true);
                setIsProcessing(false);
              }
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Add audio to queue instead of playing immediately
  const addToAudioQueue = (text: string, figureName: string, figureId: string) => {
    setAudioQueue(prev => [...prev, { text, figureName, figureId }]);
  };

  // Process audio queue - play next item if nothing is currently playing
  useEffect(() => {
    if (audioQueue.length > 0 && !isProcessingQueue && !isPlayingAudio) {
      processNextAudio();
    }
  }, [audioQueue, isProcessingQueue, isPlayingAudio]);

  const processNextAudio = async () => {
    if (audioQueue.length === 0 || isProcessingQueue) return;

    setIsProcessingQueue(true);
    const nextItem = audioQueue[0];
    
    console.log('🎵 Playing next audio from queue:', nextItem.figureName, `(${audioQueue.length} in queue)`);
    
    try {
      await playAudioNow(nextItem.text, nextItem.figureName, nextItem.figureId);
    } catch (error) {
      console.error('Error playing queued audio:', error);
    } finally {
      // Remove this item from queue
      setAudioQueue(prev => prev.slice(1));
      setIsProcessingQueue(false);
    }
  };

  const toggleVoiceRecognition = () => {
    if (!recognition) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };


  const playAudioNow = async (text: string, figureName: string, figureId: string) => {
    try {
      console.log('🎤 Generating Azure TTS for:', figureName);
      
      // Set speaking figure info for video generation
      setSpeakingFigureId(figureId);
      setSpeakingFigureName(figureName);
      
      // Reset video state for new generation
      setAllVideoUrls([]);
      setIsLoadingNextChunk(true);
      
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text,
          figure_name: figureName,
          figure_id: figureId,
          voice: selectedVoices[figureId] || 'auto',
          language: language || 'en-US'
        }
      });

      if (error) throw error;

      if (data?.audioContent) {
        // Create data URL for video generation
        const audioDataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        setCurrentAudioUrl(audioDataUrl);
        console.log('🎬 Audio ready for chunked video generation');
        
        // Start chunked video generation
        const imageUrl = avatarUrls[figureId];
        if (imageUrl) {
          chunkedVideo.generateChunkedVideo(
            imageUrl,
            audioDataUrl,
            figureId,
            figureName,
            (videoUrl) => {
              // Called when each chunk is ready
              console.log('📹 Video chunk ready');
              setAllVideoUrls(prev => [...prev, videoUrl]);
              setIsLoadingNextChunk(chunkedVideo.isGenerating);
            },
            () => {
              // Called when all chunks complete
              console.log('✅ All video chunks generated');
              setIsLoadingNextChunk(false);
            }
          );
        }
        
        // Initialize audio element if needed
        if (!audioElementRef.current) {
          audioElementRef.current = new Audio();
          audioElementRef.current.crossOrigin = 'anonymous';
        }

        // Set up event handlers
        audioElementRef.current.onplay = () => {
          console.log('▶️ Audio playing:', figureName);
          setIsPlayingAudio(true);
          setIsStopped(false);
          setCurrentSpeaker(figureId);
        };

        audioElementRef.current.onended = () => {
          console.log('⏹️ Audio ended:', figureName);
          setCurrentAudio(null);
          setIsPlayingAudio(false);
          setIsPaused(false);
          setCurrentSpeaker(null);
          setCurrentAudioUrl(null);
          setSpeakingFigureId(null);
          setSpeakingFigureName(null);
        };

        audioElementRef.current.onerror = (err) => {
          console.error('❌ Audio error:', err);
          setCurrentAudio(null);
          setIsPlayingAudio(false);
          setCurrentAudioUrl(null);
          setSpeakingFigureId(null);
          setSpeakingFigureName(null);
        };

        // Convert base64 to blob for playback
        const byteCharacters = atob(data.audioContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });
        const playbackUrl = URL.createObjectURL(audioBlob);

        // Set source and play
        audioElementRef.current.src = playbackUrl;
        setCurrentAudio(audioElementRef.current);
        audioElementRef.current.load();
        await audioElementRef.current.play();
        console.log('🔊 Audio playing for:', figureName);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setCurrentAudio(null);
      setIsPlayingAudio(false);
      setCurrentAudioUrl(null);
      setSpeakingFigureId(null);
      setSpeakingFigureName(null);
      setIsLoadingNextChunk(false);
      throw error;
    }
  };

  const handlePauseAudio = () => {
    if (currentAudio && !isPaused) {
      currentAudio.pause();
      setIsPlayingAudio(false);
      setIsPaused(true);
      console.log('⏸️ Audio paused');
    }
  };

  const handleResumeAudio = () => {
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
      console.log('▶️ Audio resumed');
    }
  };

  const handleReplayAudio = async () => {
    // If a figure is selected, play their last message
    if (selectedFigure) {
      const figureMessages = messages.filter(m => m.figure_id === selectedFigure && !m.is_user_message);
      if (figureMessages.length > 0) {
        const lastMessage = figureMessages[figureMessages.length - 1];
        // Stop current audio and clear queue
        handleStopAudio();
        // Play selected figure's audio
        console.log('🔄 Replaying:', lastMessage.figure_name);
        await playAudioNow(lastMessage.content, lastMessage.figure_name, lastMessage.figure_id);
      }
    } else if (currentAudio) {
      // No selection, replay current audio
      currentAudio.currentTime = 0;
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
      console.log('🔄 Audio replaying');
    }
  };

  const handleFigureSelect = (figureId: string) => {
    setSelectedFigure(figureId);
    console.log('👤 Selected figure:', figureId);
  };

  const handleStopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsPlayingAudio(false);
      setIsPaused(false);
      setIsStopped(true);
      setCurrentSpeaker(null);
      console.log('⏹️ Audio stopped');
    }
    // Clear queue to prevent auto-playing next
    setAudioQueue([]);
    setIsProcessingQueue(false);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;

    const userMessage = userInput;
    setUserInput("");
    setIsProcessing(true);

    try {
      const turnNumber = messages.length;
      
      await supabase.from("debate_messages").insert({
        debate_session_id: sessionId,
        figure_id: "user",
        figure_name: "You",
        content: userMessage,
        turn_number: turnNumber,
        is_user_message: true,
      });

      const { data, error } = await supabase.functions.invoke("debate-orchestrator", {
        body: {
          sessionId,
          userMessage,
          currentTurn: turnNumber + 1,
          language: language.split('-')[0],
        },
      });

      if (error) throw error;

      // Auto-trigger next figure if needed
      if (data?.shouldContinue) {
        setTimeout(async () => {
          await supabase.functions.invoke("debate-orchestrator", {
            body: {
              sessionId,
              currentTurn: data.nextTurn,
              language: language.split('-')[0],
            },
          });
        }, 2000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process message",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFigureClick = async (figureId: string) => {
    if (format !== "moderated" || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const turnNumber = messages.length;
      
      const { error } = await supabase.functions.invoke("debate-orchestrator", {
        body: {
          sessionId,
          selectedFigureId: figureId,
          currentTurn: turnNumber,
          language: language.split('-')[0],
        },
      });

      if (error) throw error;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to make figure speak",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueRound = async () => {
    setIsProcessing(true);
    setIsRoundComplete(false);

    try {
      // Start the next round
      const { error } = await supabase.functions.invoke("debate-orchestrator", {
        body: {
          sessionId,
          startNewRound: true,
          round: currentRound + 1,
          language: language.split('-')[0],
        },
      });

      if (error) throw error;
      setCurrentRound(prev => prev + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to continue debate",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Debate Topic</h2>
            <p className="text-muted-foreground">{topic}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Round</p>
            <p className="text-2xl font-bold text-primary">{currentRound}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {figures.map((figure) => (
          <Card
            key={figure.id}
            className={`p-4 transition-all cursor-pointer ${
              selectedFigure === figure.id
                ? "ring-2 ring-primary shadow-lg"
                : currentSpeaker === figure.id
                ? "ring-2 ring-accent shadow-md"
                : "hover:bg-muted"
            }`}
            onClick={() => {
              if (format === "moderated" && !isProcessing) {
                handleFigureClick(figure.id);
              } else {
                handleFigureSelect(figure.id);
              }
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                {avatarUrls[figure.id] && !loadingAvatars ? (
                  <img 
                    src={avatarUrls[figure.id]} 
                    alt={figure.name} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-2xl">
                    {capitalizeName(figure.name).split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="text-center w-full px-2">
                <p className="font-semibold text-sm">{capitalizeName(figure.name)}</p>
                {currentSpeaker === figure.id && (
                  <p className="text-xs text-primary animate-pulse">Speaking...</p>
                )}
                {selectedFigure === figure.id && (
                  <p className="text-xs text-accent font-semibold">Selected</p>
                )}
                {format === "moderated" && !isProcessing && (
                  <p className="text-xs text-muted-foreground">Click to speak</p>
                )}
                <Select
                  value={selectedVoices[figure.id] || ''}
                  onValueChange={(value) => {
                    setSelectedVoices(prev => ({ ...prev, [figure.id]: value }));
                  }}
                >
                  <SelectTrigger className="w-full mt-2 h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Auto voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {azureVoices[detectGender(figure.name)].map((voice) => (
                      <SelectItem key={voice.value} value={voice.value} className="text-xs">
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Talking Video Player for Current Speaker */}
      {speakingFigureId && avatarUrls[speakingFigureId] && currentAudioUrl && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm font-medium">{speakingFigureName} is speaking...</p>
          </div>
          <div className="flex justify-center">
            <RealisticAvatar
              imageUrl={avatarUrls[speakingFigureId]}
              audioUrl={currentAudioUrl}
              figureName={speakingFigureName || undefined}
              figureId={speakingFigureId}
              isGeneratingVideo={chunkedVideo.isGenerating}
              videoUrl={allVideoUrls[allVideoUrls.length - 1] || null}
              allVideoUrls={allVideoUrls}
              isLoadingNextChunk={isLoadingNextChunk}
              videoChunkProgress={chunkedVideo.totalChunks > 1 ? {
                current: chunkedVideo.currentChunkIndex + 1,
                total: chunkedVideo.totalChunks
              } : null}
              onVideoEnd={() => {
                console.log('🎬 Debate video ended');
                chunkedVideo.onVideoEnded();
              }}
            />
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Debate Messages</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAudioEnabled(!audioEnabled)}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.is_user_message ? "justify-end" : ""
                }`}
              >
                {!message.is_user_message && (
                  <Avatar className="h-8 w-8">
                    {avatarUrls[message.figure_id] && !loadingAvatars ? (
                      <img 
                        src={avatarUrls[message.figure_id]} 
                        alt={message.figure_name} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <AvatarFallback>
                        {capitalizeName(message.figure_name).split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.is_user_message
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {!message.is_user_message && (
                    <p className="text-xs font-semibold mb-1">
                      {capitalizeName(message.figure_name)}
                    </p>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      <div className="border-t border-border bg-card p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Textarea
              value={userInput + recordingTranscript}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && !isPlayingAudio && !isPaused && handleSendMessage()}
              placeholder="Add your perspective to the debate... (or click the mic to speak)"
              className="min-h-[60px] resize-none pr-12"
              disabled={isProcessing}
            />
            <Button
              onClick={toggleVoiceRecognition}
              disabled={isProcessing}
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
          {isProcessing ? (
            <Button 
              onClick={handleStopAudio}
              size="icon"
              variant="destructive"
              className="h-[60px] w-[60px]"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : isPlayingAudio ? (
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
                onClick={handleStopAudio}
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
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isProcessing}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isRoundComplete && (
        <Button 
          onClick={handleContinueRound} 
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          Continue to Round {currentRound + 1}
        </Button>
      )}
    </div>
  );
}