import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import StreamingAvatar from "./StreamingAvatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Volume2, VolumeX, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioEnabledRef = useRef(true);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Sync audioEnabled state with ref
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    loadMessages();
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

  const playAudioNow = async (text: string, figureName: string, figureId: string) => {
    try {
      console.log('🎤 Generating Azure TTS for:', figureName);
      
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text,
          figure_name: figureName,
          figure_id: figureId,
          voice: 'auto',
          language: language
        }
      });

      if (error) throw error;

      if (data?.audioContent) {
        // Initialize audio element if needed
        if (!audioElementRef.current) {
          audioElementRef.current = new Audio();
          audioElementRef.current.crossOrigin = 'anonymous';
        }

        // Set up event handlers
        audioElementRef.current.onplay = () => {
          console.log('▶️ Audio playing:', figureName);
          setIsPlayingAudio(true);
          setCurrentSpeaker(figureId);
        };

        audioElementRef.current.onended = () => {
          console.log('⏹️ Audio ended:', figureName);
          setCurrentAudio(null);
          setIsPlayingAudio(false);
          setIsPaused(false);
          setCurrentSpeaker(null);
          // Queue will automatically process next item via useEffect
        };

        audioElementRef.current.onerror = (err) => {
          console.error('❌ Audio error:', err);
          setCurrentAudio(null);
          setIsPlayingAudio(false);
        };

        // Convert base64 to blob
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
                <AvatarFallback className="text-2xl">
                  {capitalizeName(figure.name).split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
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
              </div>
            </div>
          </Card>
        ))}
      </div>

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
                    <AvatarFallback>
                      {capitalizeName(message.figure_name).split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
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

      <div className="flex gap-2">
        <Input
          placeholder="Add your perspective to the debate..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isPlayingAudio && !isPaused && handleSendMessage()}
          disabled={isProcessing}
        />
        {isPlayingAudio ? (
          // Show pause and stop buttons during audio playback
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
        ) : isPaused ? (
          // Show play and replay buttons when paused
          <div className="flex gap-2">
            <Button 
              onClick={handleResumeAudio}
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
        ) : selectedFigure ? (
          // Show play button when a figure is selected
          <div className="flex flex-col items-center gap-2">
            <Button 
              onClick={handleReplayAudio}
              size="icon"
              variant="default"
              className="h-[60px] w-[60px]"
            >
              <Play className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">Play Selected</p>
          </div>
        ) : (
          <Button onClick={handleSendMessage} disabled={isProcessing || !userInput.trim()} size="icon" className="h-[60px] w-[60px]">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isRoundComplete && format !== "moderated" && (
        <Button 
          onClick={handleContinueRound} 
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          Continue to Round {currentRound + 1}
        </Button>
      )}

      <Button variant="outline" onClick={onEnd} className="w-full">
        End Debate
      </Button>
    </div>
  );
}