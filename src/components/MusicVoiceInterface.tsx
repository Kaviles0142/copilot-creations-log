import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeMusicChat } from '@/utils/RealtimeAudio';
import { MusicAnalyzer, MusicData } from '@/utils/MusicAnalyzer';
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
  const [currentMusicData, setCurrentMusicData] = useState<MusicData | null>(null);
  const [isAnalyzingMusic, setIsAnalyzingMusic] = useState(false);
  const chatRef = useRef<RealtimeMusicChat | null>(null);
  const musicAnalyzerRef = useRef<MusicAnalyzer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMusicData = (musicData: MusicData) => {
    setCurrentMusicData(musicData);
    
    // Send music data to the chat for real-time analysis
    if (chatRef.current && isConnected) {
      chatRef.current.sendMusicAnalysis(musicData);
    }
  };

  const startMusicAnalysis = async () => {
    try {
      setIsAnalyzingMusic(true);
      musicAnalyzerRef.current = new MusicAnalyzer(handleMusicData);
      await musicAnalyzerRef.current.start();
      
      toast({
        title: "🎵 Music Analysis Active",
        description: "Now analyzing notes, chords, and tempo in real-time",
      });
    } catch (error) {
      console.error('Error starting music analysis:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to start music analysis",
        variant: "destructive",
      });
      setIsAnalyzingMusic(false);
    }
  };

  const stopMusicAnalysis = () => {
    if (musicAnalyzerRef.current) {
      musicAnalyzerRef.current.stop();
      musicAnalyzerRef.current = null;
    }
    setIsAnalyzingMusic(false);
    setCurrentMusicData(null);
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
      
      // Auto-start music analysis
      await startMusicAnalysis();
      
      toast({
        title: "🎸 Live Session Started",
        description: `${figureName} is now listening and analyzing your music!`,
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
    stopMusicAnalysis();
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
      stopMusicAnalysis();
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
              <p className="text-muted-foreground">with {figureName} + AI Music Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-lg">
              {isAnalyzingMusic ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Analyzing Music</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-sm">Analysis Off</span>
                </>
              )}
            </div>
            
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

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Real-time Music Analysis Display */}
          {currentMusicData && isAnalyzingMusic && (
            <div className="m-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg border">
              <h3 className="font-semibold text-sm mb-3 flex items-center">
                🎵 Real-time Musical Analysis
              </h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-medium">Current Note</div>
                  <div className="font-mono text-lg font-bold text-primary">
                    {currentMusicData.note || 'Silent'}
                  </div>
                  <div className="text-muted-foreground">
                    {currentMusicData.fundamentalFrequency?.toFixed(1)} Hz
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Key & Tempo</div>
                  <div className="font-mono">Key: {currentMusicData.key}</div>
                  <div className="font-mono">{currentMusicData.tempo} BPM</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Harmony</div>
                  <div className="font-mono text-xs">
                    {currentMusicData.chords && currentMusicData.chords.length > 0 
                      ? currentMusicData.chords.join(', ')
                      : 'No chords detected'}
                  </div>
                  <div className="text-muted-foreground">
                    {currentMusicData.harmonics?.length || 0} harmonics
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="px-6">
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
        </div>

        <div className="p-6 border-t">
          {!isConnected ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Ready to jam with {figureName}? He'll analyze your music in real-time and give specific note and chord feedback!
              </p>
              <Button onClick={startSession} className="w-full" size="lg">
                <Guitar className="h-4 w-4 mr-2" />
                Start AI Music Analysis Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">LIVE - {figureName} is analyzing your music</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Play your instrument! {figureName} can detect specific notes, chords, tempo, and give precise musical advice.
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => sendTextMessage("What notes am I playing? Any suggestions?")}
                  className="flex-1"
                >
                  🎵 Analyze my playing
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => sendTextMessage("What chord should I play next?")}
                  className="flex-1"
                >
                  🎸 Suggest chords
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