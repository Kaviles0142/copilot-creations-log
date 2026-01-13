import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Plus, Volume2, Loader2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  speakerName?: string;
  timestamp: Date;
  isPlaying?: boolean;
  audioUrl?: string;
}

interface RoomChatProps {
  figures: string[];
  isOpen: boolean;
  onClose: () => void;
  onSpeakingChange?: (speaking: boolean, speakerName?: string) => void;
  activeMode?: 'podcast' | 'debate' | null;
  pendingTopic?: string;
  onTopicChange?: (topic: string) => void;
  onStartMode?: () => void;
  onCancelMode?: () => void;
}

const RoomChat = ({ 
  figures, 
  isOpen, 
  onClose, 
  onSpeakingChange,
  activeMode,
  pendingTopic = '',
  onTopicChange,
  onStartMode,
  onCancelMode,
}: RoomChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [figuresJoined, setFiguresJoined] = useState<Set<string>>(new Set());
  const [greetingsPlayed, setGreetingsPlayed] = useState<Set<string>>(new Set());
  const [selectedResponders, setSelectedResponders] = useState<Set<string>>(new Set(figures));
  
  // Check if everyone is selected
  const isEveryoneSelected = selectedResponders.size === figures.length && figures.every(f => selectedResponders.has(f));
  
  const selectResponder = (figureName: string) => {
    // Tapping a person selects ONLY that person
    setSelectedResponders(new Set([figureName]));
  };
  
  const selectEveryone = () => {
    // Select all figures
    setSelectedResponders(new Set(figures));
  };
  
  
  const audioQueueRef = useRef<{ audioUrl: string; figureName: string }[]>([]);
  const isProcessingAudioRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle figures joining and greeting
  useEffect(() => {
    if (!figures.length || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initializeFigures = async () => {
      // Add "You joined" message first
      addSystemMessage('You joined the call');

      // Process each figure sequentially
      for (const figureName of figures) {
        await handleFigureJoin(figureName);
      }
    };

    initializeFigures();
  }, [figures]);

  const addSystemMessage = (content: string) => {
    const message: ChatMessage = {
      id: `system-${Date.now()}-${Math.random()}`,
      type: 'system',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  };

  const addMessage = (type: 'user' | 'assistant', content: string, speakerName?: string, audioUrl?: string) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      content,
      speakerName,
      timestamp: new Date(),
      audioUrl,
    };
    setMessages(prev => [...prev, message]);
    return message.id;
  };

  const updateMessageAudio = (speakerName: string, content: string, audioUrl: string) => {
    setMessages(prev => prev.map(msg => 
      msg.speakerName === speakerName && msg.content === content && !msg.audioUrl
        ? { ...msg, audioUrl }
        : msg
    ));
  };

  const handleFigureJoin = async (figureName: string) => {
    if (figuresJoined.has(figureName)) return;

    // Add "joined" system message
    addSystemMessage(`${figureName} joined the call`);
    setFiguresJoined(prev => new Set([...prev, figureName]));

    // Wait a moment for visual effect
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate greeting
    await generateGreeting(figureName);
  };

  const generateGreeting = async (figureName: string) => {
    if (greetingsPlayed.has(figureName)) return;

    try {
      const figureId = figureName.toLowerCase().replace(/\s+/g, '-');
      
      // Generate a contextual greeting
      const greeting = getGreetingForFigure(figureName);
      
      // Add greeting message immediately
      addMessage('assistant', greeting, figureName);
      setGreetingsPlayed(prev => new Set([...prev, figureName]));

      // Generate TTS audio using Azure
      const { data: audioData, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text: greeting,
          figure_name: figureName,
        }
      });

      if (error) {
        console.error('TTS error:', error);
        return;
      }

      if (audioData?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
        updateMessageAudio(figureName, greeting, audioUrl);
        queueAudio(audioUrl, figureName);
      }
    } catch (error) {
      console.error('Error generating greeting:', error);
    }
  };

  const replayMessage = async (msg: ChatMessage) => {
    if (!msg.audioUrl || isPlayingAudio) return;
    queueAudio(msg.audioUrl, msg.speakerName || 'Unknown');
  };

  const getGreetingForFigure = (figureName: string): string => {
    const name = figureName.toLowerCase();
    
    const greetings: Record<string, string> = {
      'albert einstein': "Hello! It's wonderful to connect with you. I'm always eager to discuss the mysteries of the universe.",
      'marie curie': "Bonjour! I'm delighted to join this conversation. Science awaits!",
      'leonardo da vinci': "Buongiorno! What fascinating topics shall we explore today?",
      'napoleon bonaparte': "Greetings! I am ready to share my perspectives on leadership and strategy.",
      'cleopatra': "Welcome. I look forward to our discourse on history and governance.",
      'william shakespeare': "Good morrow! What tales and wisdom shall we exchange?",
      'steph curry': "Hey, what's up everyone! Great to be here, let's talk!",
      'lebron james': "What's good! Happy to join this call, let's chop it up.",
      'elon musk': "Hey! This is pretty cool. What should we discuss?",
      'steve jobs': "Hello. I'm excited to explore ideas together.",
    };

    for (const [key, greeting] of Object.entries(greetings)) {
      if (name.includes(key)) return greeting;
    }

    return `Hello everyone! Great to join this conversation. I'm ${figureName}, ready to share my thoughts and perspectives.`;
  };

  const queueAudio = (audioUrl: string, figureName: string) => {
    audioQueueRef.current.push({ audioUrl, figureName });
    processAudioQueue();
  };

  const processAudioQueue = async () => {
    if (isProcessingAudioRef.current || audioQueueRef.current.length === 0) return;

    isProcessingAudioRef.current = true;
    setIsPlayingAudio(true);
    onSpeakingChange?.(true);

    while (audioQueueRef.current.length > 0) {
      const { audioUrl, figureName } = audioQueueRef.current.shift()!;
      await playAudio(audioUrl, figureName);
      // Small pause between messages
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    isProcessingAudioRef.current = false;
    setIsPlayingAudio(false);
    onSpeakingChange?.(false);
  };

  const playAudio = (audioUrl: string, figureName: string): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      
      // Notify that this figure is now speaking
      onSpeakingChange?.(true, figureName);
      
      // Mark message as playing
      setMessages(prev => prev.map(msg => 
        msg.speakerName === figureName && msg.type === 'assistant'
          ? { ...msg, isPlaying: true }
          : msg
      ));

      audio.onended = () => {
        // Notify speaking stopped
        onSpeakingChange?.(false, undefined);
        
        // Unmark message
        setMessages(prev => prev.map(msg => 
          msg.speakerName === figureName
            ? { ...msg, isPlaying: false }
            : msg
        ));
        resolve();
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        resolve();
      };

      audio.play().catch((err) => {
        console.error('Failed to play audio:', err);
        resolve();
      });
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message
    addMessage('user', userMessage, 'You');
    setIsLoading(true);

    try {
      // Get responses only from selected figures
      const respondingFigures = figures.filter(f => selectedResponders.has(f));
      for (const figureName of respondingFigures) {
        const figureId = figureName.toLowerCase().replace(/\s+/g, '-');
        
        // Build conversation context from recent messages
        const recentContext = messages
          .slice(-10)
          .map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.speakerName ? `${msg.speakerName}: ${msg.content}` : msg.content
          }));

        // Call the chat edge function with full research capabilities
        const { data: chatData, error: chatError } = await supabase.functions.invoke('chat-with-historical-figure', {
          body: {
            message: userMessage,
            figure: {
              id: figureId,
              name: figureName,
            },
            context: recentContext,
            conversationType: 'casual',
            language: 'en',
          }
        });

        if (chatError) {
          console.error('Chat error:', chatError);
          addMessage('assistant', "I'm having trouble responding right now. Please try again.", figureName);
          continue;
        }

        const response = chatData?.reply || chatData?.response || "I couldn't generate a response.";
        
        // Add the response message
        addMessage('assistant', response, figureName);

        // Generate TTS for the response using Azure
        const { data: audioData, error: audioError } = await supabase.functions.invoke('azure-text-to-speech', {
          body: {
            text: response,
            figure_name: figureName,
          }
        });

        if (!audioError && audioData?.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
          updateMessageAudio(figureName, response, audioUrl);
          queueAudio(audioUrl, figureName);
        }

        // Small delay between figure responses for natural flow
        if (respondingFigures.indexOf(figureName) < respondingFigures.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('assistant', "Something went wrong. Please try again.", figures[0] || 'System');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-x-0 bottom-0 h-[60vh] md:static md:h-auto md:w-96 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col z-50 animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-foreground font-semibold">Chat</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 p-4 overflow-x-auto scrollbar-none">
          {figures.length > 1 && (
            <Badge 
              className={`cursor-pointer transition-all select-none shrink-0 whitespace-nowrap ${
                isEveryoneSelected 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectEveryone();
              }}
            >
              Everyone
            </Badge>
          )}
          {figures.map((figure) => (
            <Badge 
              key={figure}
              className={`cursor-pointer transition-all select-none shrink-0 whitespace-nowrap ${
                selectedResponders.has(figure) && selectedResponders.size === 1
                  ? 'bg-primary text-primary-foreground' 
                  : isEveryoneSelected
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectResponder(figure);
              }}
            >
              {figure}
            </Badge>
          ))}
          {isPlayingAudio && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              <Volume2 className="w-3 h-3 mr-1" />
              Speaking...
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === 'system' ? (
                // System message - join notifications
                <p className="text-xs text-muted-foreground italic text-center py-1">
                  {msg.content}
                </p>
              ) : msg.type === 'user' ? (
                // User message
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ) : (
                // Assistant/Figure message
                <div className="flex flex-col">
                  <button 
                    onClick={() => replayMessage(msg)}
                    disabled={!msg.audioUrl || isPlayingAudio}
                    className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer disabled:cursor-default disabled:hover:text-muted-foreground w-fit"
                  >
                    {msg.speakerName}
                    {msg.isPlaying ? (
                      <Volume2 className="w-3 h-3 animate-pulse text-primary" />
                    ) : msg.audioUrl && (
                      <Volume2 className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                    )}
                  </button>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 max-w-[85%]">
                    <p className="text-sm text-foreground">{msg.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs italic">Thinking...</span>
            </div>
          )}
          
          {/* Mode setup prompt */}
          {activeMode && (
            <div className="bg-accent/50 border border-accent rounded-lg p-3 mt-2">
              <p className="text-sm text-foreground mb-2">
                {activeMode === 'podcast' 
                  ? '🎙️ Podcast Mode enabled! Enter a topic for discussion:'
                  : '⚔️ Debate Mode enabled! Enter a topic for the debate:'}
              </p>
              <Input
                value={pendingTopic}
                onChange={(e) => onTopicChange?.(e.target.value)}
                placeholder={activeMode === 'podcast' ? 'e.g., The future of AI' : 'e.g., Was the French Revolution successful?'}
                className="mb-2 bg-background"
                onKeyDown={(e) => e.key === 'Enter' && pendingTopic.trim() && onStartMode?.()}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={onStartMode}
                  disabled={!pendingTopic.trim()}
                >
                  Start {activeMode === 'podcast' ? 'Podcast' : 'Debate'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onCancelMode}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isEveryoneSelected ? "Message everyone" : `Message ${[...selectedResponders].join(', ')}`}
            className="flex-1 bg-background border-border"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isLoading}
          />
          <Button 
            size="icon" 
            variant="ghost"
            onClick={handleSendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            className="text-muted-foreground hover:text-foreground"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default RoomChat;
