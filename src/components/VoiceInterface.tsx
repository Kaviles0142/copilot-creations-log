import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';

interface VoiceInterfaceProps {
  selectedFigure: any;
  onSpeakingChange: (speaking: boolean) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ selectedFigure, onSpeakingChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const chatRef = useRef<RealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('Voice interface received message:', event);
    
    setMessages(prev => [...prev, event]);
    
    // Handle different event types
    if (event.type === 'response.audio.delta') {
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      onSpeakingChange(false);
    } else if (event.type === 'connection_established') {
      toast({
        title: "Connected",
        description: "Connecting to OpenAI...",
      });
    } else if (event.type === 'session_ready') {
      toast({
        title: "Ready to Chat",
        description: `Start talking to ${selectedFigure.name}!`,
      });
    } else if (event.type === 'error') {
      toast({
        title: "Error",
        description: event.message,
        variant: "destructive",
      });
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    setIsConnecting(false);
    if (!connected) {
      onSpeakingChange(false);
    }
  };

  const startConversation = async () => {
    if (!selectedFigure) {
      toast({
        title: "Error",
        description: "Please select a historical figure first",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🚀 Starting conversation with:', selectedFigure.name);
      setIsConnecting(true);
      
      chatRef.current = new RealtimeChat(
        selectedFigure,
        handleMessage,
        handleConnectionChange
      );
      
      console.log('🔗 Attempting to connect...');
      await chatRef.current.connect();
      console.log('✅ Connection successful!');
      
    } catch (error) {
      console.error('❌ Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setMessages([]);
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  if (!selectedFigure) {
    return (
      <Card className="p-6 text-center">
        <h3 className="font-semibold mb-2">Voice Chat</h3>
        <p className="text-sm text-muted-foreground">
          Select a historical figure to start a voice conversation
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <h3 className="font-semibold text-lg">Voice Chat with {selectedFigure.name}</h3>
        
        <div className="flex items-center space-x-4">
          {!isConnected && !isConnecting ? (
            <Button 
              onClick={startConversation}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Phone className="w-4 h-4 mr-2" />
              Start Voice Chat
            </Button>
          ) : isConnecting ? (
            <Button disabled className="bg-yellow-500">
              <Mic className="w-4 h-4 mr-2 animate-pulse" />
              Connecting...
            </Button>
          ) : (
            <Button 
              onClick={endConversation}
              variant="destructive"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              End Call
            </Button>
          )}
        </div>

        {isConnected && (
          <div className="w-full text-center">
            <div className="animate-pulse">
              <Mic className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                Listening... Speak naturally to {selectedFigure.name}
              </p>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="w-full max-h-40 overflow-y-auto">
            <h4 className="font-medium mb-2">Voice Chat Log:</h4>
            <div className="text-xs space-y-1">
              {messages.slice(-5).map((msg, idx) => (
                <div key={idx} className="text-muted-foreground">
                  {msg.type}: {msg.message || 'Audio data'}
                </div>
              ))}
            </div>
          </div>
        )}

        {isConnected && (
          <div className="text-xs text-muted-foreground text-center">
            <p>🎙️ Real-time voice conversation active</p>
            <p>Your voice is being transmitted to {selectedFigure.name}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default VoiceInterface;