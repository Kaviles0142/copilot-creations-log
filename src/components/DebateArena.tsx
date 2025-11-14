import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import StreamingAvatar from "./StreamingAvatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Volume2, VolumeX } from "lucide-react";
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
  onEnd: () => void;
}

export default function DebateArena({ sessionId, topic, figures, format, onEnd }: DebateArenaProps) {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
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

    if (data) setMessages(data);
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
          setMessages((prev) => [...prev, payload.new as DebateMessage]);
          
          const newMessage = payload.new as DebateMessage;
          if (!newMessage.is_user_message) {
            setCurrentSpeaker(newMessage.figure_id);
            
            // Play audio if enabled and wait for it to finish
            if (audioEnabled) {
              await playAudio(newMessage.content, newMessage.figure_name, newMessage.figure_id);
            }
            
            setTimeout(() => setCurrentSpeaker(null), 2000);

            // Auto-trigger next turn for non-moderated formats
            if (format !== "moderated") {
              // Wait a bit after audio finishes before next speaker
              setTimeout(async () => {
                const { data, error } = await supabase.functions.invoke("debate-orchestrator", {
                  body: {
                    sessionId,
                    currentTurn: newMessage.turn_number + 1,
                  },
                });
                
                if (error) {
                  console.error("Error auto-continuing debate:", error);
                }
              }, 2000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const playAudio = async (text: string, figureName: string, figureId: string) => {
    try {
      console.log('🎤 Generating Azure TTS for:', figureName);
      
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text,
          figure_name: figureName,
          figure_id: figureId,
          voice: 'auto' // Let Azure auto-select based on nationality
        }
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        // Wait for audio to finish playing
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve(); // Continue even if audio fails
          audio.play().catch(() => resolve());
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
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

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary">
        <h2 className="text-xl font-bold mb-2">Debate Topic</h2>
        <p className="text-muted-foreground">{topic}</p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {figures.map((figure) => (
          <Card
            key={figure.id}
            className={`p-4 transition-all ${
              currentSpeaker === figure.id
                ? "ring-2 ring-primary shadow-lg"
                : format === "moderated" ? "cursor-pointer hover:bg-muted" : ""
            }`}
            onClick={() => format === "moderated" && !isProcessing && handleFigureClick(figure.id)}
          >
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {figure.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold text-sm">{figure.name}</p>
                {currentSpeaker === figure.id && (
                  <p className="text-xs text-primary animate-pulse">Speaking...</p>
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
                      {message.figure_name.split(" ").map(n => n[0]).join("")}
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
                      {message.figure_name}
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
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          disabled={isProcessing}
        />
        <Button onClick={handleSendMessage} disabled={isProcessing || !userInput.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <Button variant="outline" onClick={onEnd} className="w-full">
        End Debate
      </Button>
    </div>
  );
}