import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, X, Volume2, Loader2, Pause, Play, FileText, RefreshCw, Users, Check, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  onAddParticipant?: (name: string) => void;
  onRemoveParticipant?: (name: string) => void;
  showParticipantsModal?: boolean;
  onParticipantsModalChange?: (open: boolean) => void;
  onModeStateChange?: (state: { running: boolean; paused: boolean; topic: string; pause: () => void; resume: () => void; stop: () => void }) => void;
  onFileUploadRef?: (trigger: () => void) => void;
  conversationTone?: 'casual' | 'educational' | 'philosophical';
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
  onAddParticipant,
  onRemoveParticipant,
  showParticipantsModal = false,
  onParticipantsModalChange,
  onModeStateChange,
  onFileUploadRef,
  conversationTone = 'casual',
}: RoomChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [figuresJoined, setFiguresJoined] = useState<Set<string>>(new Set());
  const [greetingsPlayed, setGreetingsPlayed] = useState<Set<string>>(new Set());
  const [selectedResponders, setSelectedResponders] = useState<Set<string>>(new Set(figures));
  
  // Participants modal state - controlled by parent if provided
  const [newParticipantName, setNewParticipantName] = useState('');
  // Mode orchestration state
  const [modeRunning, setModeRunning] = useState(false);
  const [modePaused, setModePaused] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('');
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const orchestrationRef = useRef<NodeJS.Timeout | null>(null);
  const pausedRef = useRef(false);
  
  // File upload state
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio control refs for pause/resume
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<{ audioUrl: string; figureName: string; content: string }[]>([]);
  const isProcessingAudioRef = useRef(false);
  const onAudioCompleteRef = useRef<(() => void) | null>(null);
  
  const { toast } = useToast();
  
  // Check if everyone is selected
  const isEveryoneSelected = selectedResponders.size === figures.length && figures.every(f => selectedResponders.has(f));
  
  const selectResponder = (figureName: string) => {
    setSelectedResponders(new Set([figureName]));
  };
  
  const selectEveryone = () => {
    setSelectedResponders(new Set(figures));
  };
  
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
      addSystemMessage('You joined the call');
      for (const figureName of figures) {
        await handleFigureJoin(figureName);
      }
    };

    initializeFigures();
  }, [figures]);

  // Cleanup orchestration and audio on unmount
  useEffect(() => {
    return () => {
      if (orchestrationRef.current) {
        clearTimeout(orchestrationRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Sync paused ref
  useEffect(() => {
    pausedRef.current = modePaused;
  }, [modePaused]);

  // Notify parent of mode state changes (with controls)
  useEffect(() => {
    onModeStateChange?.({ 
      running: modeRunning, 
      paused: modePaused, 
      topic: currentTopic,
      pause: () => pauseMode(),
      resume: () => resumeMode(),
      stop: () => stopMode(),
    });
  }, [modeRunning, modePaused, currentTopic]);

  // Expose file upload trigger to parent
  useEffect(() => {
    onFileUploadRef?.(() => fileInputRef.current?.click());
  }, [onFileUploadRef]);

  // Auto-start mode when topic is provided from config dialog
  const autoStartTriggeredRef = useRef(false);
  useEffect(() => {
    if (activeMode && !modeRunning && pendingTopic.trim() && !autoStartTriggeredRef.current) {
      autoStartTriggeredRef.current = true;
      startModeOrchestration(pendingTopic.trim());
    }
    // Reset when mode ends
    if (!activeMode) {
      autoStartTriggeredRef.current = false;
    }
  }, [activeMode, modeRunning, pendingTopic]);


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

    addSystemMessage(`${figureName} joined the call`);
    setFiguresJoined(prev => new Set([...prev, figureName]));

    await new Promise(resolve => setTimeout(resolve, 500));
    await generateGreeting(figureName);
  };

  const generateGreeting = async (figureName: string) => {
    if (greetingsPlayed.has(figureName)) return;

    try {
      const greeting = getGreetingForFigure(figureName);
      addMessage('assistant', greeting, figureName);
      setGreetingsPlayed(prev => new Set([...prev, figureName]));

      const { data: audioData, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: { text: greeting, figure_name: figureName }
      });

      if (error) {
        console.error('TTS error:', error);
        return;
      }

      if (audioData?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
        updateMessageAudio(figureName, greeting, audioUrl);
        queueAudio(audioUrl, figureName, greeting);
      }
    } catch (error) {
      console.error('Error generating greeting:', error);
    }
  };

  const replayMessage = async (msg: ChatMessage) => {
    if (!msg.audioUrl || isPlayingAudio) return;
    queueAudio(msg.audioUrl, msg.speakerName || 'Unknown', msg.content);
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

  // Queue audio with content for synced message display
  const queueAudio = (audioUrl: string, figureName: string, content: string) => {
    audioQueueRef.current.push({ audioUrl, figureName, content });
    processAudioQueue();
  };

  // Queue audio for mode orchestration with callback when complete
  const queueModeAudio = (audioUrl: string, figureName: string, content: string): Promise<void> => {
    return new Promise((resolve) => {
      audioQueueRef.current.push({ audioUrl, figureName, content });
      onAudioCompleteRef.current = resolve;
      processAudioQueue();
    });
  };

  const processAudioQueue = async () => {
    if (isProcessingAudioRef.current || audioQueueRef.current.length === 0) return;

    isProcessingAudioRef.current = true;
    setIsPlayingAudio(true);
    onSpeakingChange?.(true);

    while (audioQueueRef.current.length > 0) {
      // Wait while paused
      while (pausedRef.current) {
        // If we have a current audio, pause it
        if (currentAudioRef.current && !currentAudioRef.current.paused) {
          currentAudioRef.current.pause();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Resume audio if it was paused
      if (currentAudioRef.current && currentAudioRef.current.paused && currentAudioRef.current.currentTime > 0) {
        await new Promise<void>((resolve) => {
          const audio = currentAudioRef.current!;
          audio.onended = () => {
            currentAudioRef.current = null;
            resolve();
          };
          audio.play().catch(() => resolve());
        });
        continue;
      }
      
      const item = audioQueueRef.current.shift()!;
      await playAudio(item.audioUrl, item.figureName);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    isProcessingAudioRef.current = false;
    setIsPlayingAudio(false);
    onSpeakingChange?.(false);
    
    // Notify any waiting orchestration
    if (onAudioCompleteRef.current) {
      onAudioCompleteRef.current();
      onAudioCompleteRef.current = null;
    }
  };

  const playAudio = (audioUrl: string, figureName: string): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      onSpeakingChange?.(true, figureName);
      
      setMessages(prev => prev.map(msg => 
        msg.speakerName === figureName && msg.type === 'assistant'
          ? { ...msg, isPlaying: true }
          : msg
      ));

      audio.onended = () => {
        currentAudioRef.current = null;
        onSpeakingChange?.(false, undefined);
        setMessages(prev => prev.map(msg => 
          msg.speakerName === figureName
            ? { ...msg, isPlaying: false }
            : msg
        ));
        resolve();
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        currentAudioRef.current = null;
        resolve();
      };

      audio.play().catch((err) => {
        console.error('Failed to play audio:', err);
        currentAudioRef.current = null;
        resolve();
      });
    });
  };

  // Mode orchestration functions
  const startModeOrchestration = async (topic: string) => {
    setModeRunning(true);
    setModePaused(false);
    setCurrentTopic(topic);
    setCurrentSpeakerIndex(0);
    
    addSystemMessage(`${activeMode === 'podcast' ? '🎙️ Podcast' : '⚔️ Debate'} started: "${topic}"`);
    
    // Start the orchestration loop
    await runOrchestrationTurn(topic, 0, []);
  };

  const runOrchestrationTurn = useCallback(async (topic: string, speakerIndex: number, history: ChatMessage[]) => {
    // Check refs instead of state for immediate values
    if (pausedRef.current) {
      console.log('Orchestration paused, waiting...');
      return;
    }

    try {
      console.log(`🎙️ Running turn for speaker ${speakerIndex}, topic: ${topic}`);
      
      const { data, error } = await supabase.functions.invoke('room-orchestrator', {
        body: {
          figures,
          topic,
          mode: activeMode,
          conversationHistory: history.map(m => ({ speakerName: m.speakerName, content: m.content })),
          currentSpeakerIndex: speakerIndex,
        }
      });

      if (error) throw error;

      if (data?.content) {
        // Generate TTS first, then show message when audio is ready
        const { data: audioData } = await supabase.functions.invoke('azure-text-to-speech', {
          body: { text: data.content, figure_name: data.speakerName }
        });

        // Only add message once TTS is ready (or failed)
        const messageId = addMessage('assistant', data.content, data.speakerName);

        if (audioData?.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
          updateMessageAudio(data.speakerName, data.content, audioUrl);
          
          // Wait for audio to complete before next turn
          await queueModeAudio(audioUrl, data.speakerName, data.content);
        }

        // Update history for next turn
        const newHistory = [...history, { 
          id: `hist-${Date.now()}`, 
          type: 'assistant' as const, 
          content: data.content, 
          speakerName: data.speakerName, 
          timestamp: new Date() 
        }];

        // Keep only last 15 messages for context
        const trimmedHistory = newHistory.slice(-15);

        // Continue to next turn immediately after audio finishes
        const nextIndex = data.nextSpeakerIndex;
        setCurrentSpeakerIndex(nextIndex);
        
        // Small delay then continue (no fixed 6s wait)
        if (!pausedRef.current) {
          orchestrationRef.current = setTimeout(() => {
            runOrchestrationTurn(topic, nextIndex, trimmedHistory);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Orchestration error:', error);
      toast({
        title: 'Error',
        description: 'Failed to continue the conversation. Retrying...',
        variant: 'destructive',
      });
      
      // Retry after a delay
      orchestrationRef.current = setTimeout(() => {
        if (!pausedRef.current) {
          runOrchestrationTurn(topic, speakerIndex, history);
        }
      }, 3000);
    }
  }, [figures, activeMode, toast]);

  const pauseMode = () => {
    setModePaused(true);
    pausedRef.current = true;
    
    // Pause the currently playing audio
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
    }
    
    if (orchestrationRef.current) {
      clearTimeout(orchestrationRef.current);
    }
    addSystemMessage(`${activeMode === 'podcast' ? '🎙️ Podcast' : '⚔️ Debate'} paused`);
  };

  const resumeMode = () => {
    setModePaused(false);
    pausedRef.current = false;
    
    // Resume the paused audio if any
    if (currentAudioRef.current && currentAudioRef.current.paused && currentAudioRef.current.currentTime > 0) {
      currentAudioRef.current.play().catch(console.error);
      addSystemMessage(`${activeMode === 'podcast' ? '🎙️ Podcast' : '⚔️ Debate'} resumed`);
      // Audio queue will continue after current audio ends
      return;
    }
    
    addSystemMessage(`${activeMode === 'podcast' ? '🎙️ Podcast' : '⚔️ Debate'} resumed`);
    
    // If no audio was paused, continue with next turn
    const recentMessages = messages.filter(m => m.type === 'assistant').slice(-10);
    runOrchestrationTurn(currentTopic, currentSpeakerIndex, recentMessages);
  };

  const switchTopic = () => {
    if (orchestrationRef.current) {
      clearTimeout(orchestrationRef.current);
    }
    const newTopic = pendingTopic.trim();
    setCurrentTopic(newTopic);
    setCurrentSpeakerIndex(0);
    onTopicChange?.('');
    
    addSystemMessage(`Topic changed to: "${newTopic}"`);
    runOrchestrationTurn(newTopic, 0, []);
  };

  const stopMode = () => {
    setModeRunning(false);
    setModePaused(false);
    pausedRef.current = false;
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    // Clear audio queue
    audioQueueRef.current = [];
    isProcessingAudioRef.current = false;
    setIsPlayingAudio(false);
    
    if (orchestrationRef.current) {
      clearTimeout(orchestrationRef.current);
    }
    addSystemMessage(`${activeMode === 'podcast' ? '🎙️ Podcast' : '⚔️ Debate'} ended`);
    onCancelMode?.();
  };


  // File upload handling
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingFile(true);
    addSystemMessage(`📄 Uploading document: ${file.name}`);

    try {
      const respondingFigures = figures.filter(f => selectedResponders.has(f));
      
      for (const figureName of respondingFigures) {
        const figureId = figureName.toLowerCase().replace(/\s+/g, '-');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('figureName', figureName);
        formData.append('figureId', figureId);
        formData.append('prompt', inputMessage || 'Please review this document and provide your feedback.');

        const { data, error } = await supabase.functions.invoke('analyze-document', {
          body: formData,
        });

        if (error) {
          console.error('Document analysis error:', error);
          addMessage('assistant', "I'm having trouble analyzing the document. Please try again.", figureName);
          continue;
        }

        if (data?.content) {
          addMessage('assistant', data.content, figureName);

          // Generate TTS
          const { data: audioData } = await supabase.functions.invoke('azure-text-to-speech', {
            body: { text: data.content, figure_name: figureName }
          });

          if (audioData?.audioContent) {
            const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
            updateMessageAudio(figureName, data.content, audioUrl);
            queueAudio(audioUrl, figureName, data.content);
          }
        }
      }

      setInputMessage('');
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    addMessage('user', userMessage, 'You');
    setIsLoading(true);

    try {
      const respondingFigures = figures.filter(f => selectedResponders.has(f));
      for (const figureName of respondingFigures) {
        const figureId = figureName.toLowerCase().replace(/\s+/g, '-');
        
        const recentContext = messages
          .slice(-10)
          .map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.speakerName ? `${msg.speakerName}: ${msg.content}` : msg.content
          }));

        const { data: chatData, error: chatError } = await supabase.functions.invoke('chat-with-historical-figure', {
          body: {
            message: userMessage,
            figure: { id: figureId, name: figureName },
            context: recentContext,
            conversationType: conversationTone,
            language: 'en',
          }
        });

        if (chatError) {
          console.error('Chat error:', chatError);
          addMessage('assistant', "I'm having trouble responding right now. Please try again.", figureName);
          continue;
        }

        const response = chatData?.reply || chatData?.response || "I couldn't generate a response.";
        addMessage('assistant', response, figureName);

        const { data: audioData, error: audioError } = await supabase.functions.invoke('azure-text-to-speech', {
          body: { text: response, figure_name: figureName }
        });

        if (!audioError && audioData?.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
          updateMessageAudio(figureName, response, audioUrl);
          queueAudio(audioUrl, figureName, response);
        }

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
    <>
      <aside className="fixed inset-x-0 bottom-0 h-[60vh] md:static md:h-auto md:w-80 bg-background border-t md:border-t-0 md:border-l border-border/50 flex flex-col z-50 animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
        {/* Minimal Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Chat</h3>
            {isPlayingAudio && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Volume2 className="w-3 h-3 animate-pulse text-primary" />
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef}>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.type === 'system' ? (
                  <p className="text-[11px] text-muted-foreground/70 text-center py-1">
                    {msg.content}
                  </p>
                ) : msg.type === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-1.5 max-w-[85%]">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={() => replayMessage(msg)}
                      disabled={!msg.audioUrl || isPlayingAudio}
                      className="text-[11px] font-medium text-muted-foreground/80 flex items-center gap-1 hover:text-foreground transition-colors w-fit"
                    >
                      {msg.speakerName}
                      {msg.isPlaying && <Volume2 className="w-2.5 h-2.5 animate-pulse text-primary" />}
                    </button>
                    <div className="bg-muted/50 rounded-2xl rounded-tl-md px-3 py-1.5 max-w-[85%]">
                      <p className="text-sm text-foreground">{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {(isLoading || isUploadingFile) && (
              <div className="flex items-center gap-2 text-muted-foreground py-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs">{isUploadingFile ? 'Analyzing...' : 'Thinking...'}</span>
              </div>
            )}
            
          </div>
        </ScrollArea>

        {/* Footer with input */}
        <div className="flex-shrink-0 p-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf"
              className="hidden"
            />
            
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={modeRunning ? "Change topic..." : "Message..."}
              className="flex-1 h-8 text-sm bg-muted/30 border-0 focus-visible:ring-1"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={isLoading || isUploadingFile}
            />
            
            <Button
              size="icon" 
              variant="ghost"
              onClick={handleSendMessage} 
              disabled={isLoading || isUploadingFile || !inputMessage.trim()}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Participants Modal */}
      <Dialog open={showParticipantsModal} onOpenChange={onParticipantsModalChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Participants</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* Current participants */}
            <div className="space-y-1.5">
              {figures.map((figure) => (
                <div key={figure} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {figure.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{figure}</span>
                  </div>
                  {figures.length > 1 && onRemoveParticipant && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        onRemoveParticipant(figure);
                        onParticipantsModalChange?.(false);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add participant */}
            {onAddParticipant && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Add participant</p>
                <div className="flex gap-2">
                  <Input
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="e.g., Nikola Tesla"
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newParticipantName.trim()) {
                        onAddParticipant(newParticipantName.trim());
                        setNewParticipantName('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!newParticipantName.trim()}
                    onClick={() => {
                      onAddParticipant(newParticipantName.trim());
                      setNewParticipantName('');
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RoomChat;
