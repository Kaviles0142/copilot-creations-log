import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeMusicChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Volume2, VolumeX, Guitar } from 'lucide-react';

interface MusicVoiceInterfaceProps {
  figureId: string;
  figureName: string;
  onClose: () => void;
}

interface ChatMessage {
  type: 'user_transcript' | 'assistant_transcript' | 'system';
  content: string;
  timestamp: Date;
}

const MusicVoiceInterface: React.FC<MusicVoiceInterfaceProps> = ({ 
  figureId, 
  figureName, 
  onClose 
}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatRef = useRef<RealtimeMusicChat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessage = (message: any) => {
    console.log('Received message:', message);
    
    if (message.type === 'assistant_transcript') {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        
        if (lastMessage && lastMessage.type === 'assistant_transcript') {
          // Update existing message
          lastMessage.content += message.content;
        } else {
          // Create new message
          newMessages.push({
            type: 'assistant_transcript',
            content: message.content,
            timestamp: new Date()
          });
        }
        return newMessages;
      });
      setIsSpeaking(true);
    } else if (message.type === 'user_transcript') {
      setMessages(prev => [...prev, {
        type: 'user_transcript',
        content: message.content,
        timestamp: new Date()
      }]);
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    setIsListening(connected);
    if (!connected) {
      setIsSpeaking(false);
    }
  };

  const startSession = async () => {
    try {
      // Add welcome message
      setMessages([{
        type: 'system',
        content: `🎸 Starting live music session with ${figureName}. Play your instrument and ${figureName} will listen and give you feedback in real-time!`,
        timestamp: new Date()
      }]);

      chatRef.current = new RealtimeMusicChat(
        figureId,
        handleMessage,
        handleConnectionChange
      );
      
      await chatRef.current.connect();
      
      toast({
        title: "🎸 Live Session Started",
        description: `${figureName} is now listening! Start playing your instrument.`,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start session',
        variant: "destructive",
      });
    }
  };

  const endSession = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    
    toast({
      title: "Session Ended",
      description: "Music session with " + figureName + " has ended.",
    });
  };

  const sendTextMessage = (text: string) => {
    if (!chatRef.current || !isConnected) return;
    
    try {
      chatRef.current.sendMessage(text);
      setMessages(prev => [...prev, {
        type: 'user_transcript',
        content: text,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Guitar className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Live Music Session</h2>
              <p className="text-muted-foreground">with {figureName}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-lg">
              {isListening ? (
                <>
                  <Mic className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Listening</span>
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Not listening</span>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-lg">
              {isSpeaking ? (
                <>
                  <Volume2 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{figureName} speaking</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Silent</span>
                </>
              )}
            </div>
            
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.type === 'user_transcript' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.type === 'user_transcript'
                    ? 'bg-primary text-primary-foreground'
                    : message.type === 'assistant_transcript'
                    ? 'bg-muted'
                    : 'bg-accent text-center text-muted-foreground'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 border-t">
          {!isConnected ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Ready to jam with {figureName}? He'll listen to your playing and give you real-time feedback!
              </p>
              <Button onClick={startSession} className="w-full" size="lg">
                <Guitar className="h-4 w-4 mr-2" />
                Start Live Music Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">LIVE - {figureName} is listening</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Play your instrument, sing, or ask questions. {figureName} can hear everything!
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => sendTextMessage("What do you think of my playing so far?")}
                  className="flex-1"
                >
                  Ask for feedback
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => sendTextMessage("Can you give me some tips to improve?")}
                  className="flex-1"
                >
                  Get improvement tips
                </Button>
                <Button variant="destructive" onClick={endSession}>
                  End Session
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MusicVoiceInterface;