import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Send, User, Bot, Volume2, VolumeX, Mic, MicOff, Search, Play } from "lucide-react";
import AvatarSelector from "./AvatarSelector";
import ChatMessages from "./ChatMessages";
import FileUpload from "./FileUpload";

export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
}

export interface HistoricalFigure {
  id: string;
  name: string;
  period: string;
  description: string;
  avatar: string;
}

const HistoricalChat = () => {
  const [selectedFigure, setSelectedFigure] = useState<HistoricalFigure | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
        console.log('Voice recognition started');
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(prev => prev + transcript);
        console.log('Speech recognition result:', transcript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        console.log('Voice recognition ended');
      };
      
      setRecognition(recognition);
    }
  }, []);

  const toggleVoiceRecognition = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedFigure) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      type: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Call OpenAI through our Edge Function
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/chat-with-historical-figure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          historicalFigure: selectedFigure,
          conversationHistory: messages
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        type: "assistant",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Generate speech for the response
      await generateSpeech(data.response, selectedFigure);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble responding right now. Please try again.",
        type: "assistant", 
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWikipediaSearch = async (query: string) => {
    const wikipediaData = await searchWikipedia(query);
    if (wikipediaData) {
      const searchMessage: Message = {
        id: Date.now().toString(),
        content: `📖 **${wikipediaData.title}**\n\n${wikipediaData.extract}\n\n[Read more on Wikipedia](${wikipediaData.url})`,
        type: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, searchMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const generateSpeech = async (text: string, figure: HistoricalFigure) => {
    try {
      // Stop any current audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Choose voice based on historical figure characteristics
      const voice = getVoiceForFigure(figure);

      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: voice
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      // Create audio element and play
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      setCurrentAudio(audio);
      setIsPlayingAudio(true);

      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentAudio(null);
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setCurrentAudio(null);
        console.error('Error playing audio');
      };

      await audio.play();
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsPlayingAudio(false);
    }
  };

  const getVoiceForFigure = (figure: HistoricalFigure): string => {
    // Map historical figures to regionally appropriate voices
    const voiceMap: Record<string, string> = {
      'winston-churchill': 'George', // British accent
      'albert-einstein': 'Brian',    // For German-accented English
      'marie-curie': 'Charlotte',    // French accent
      'leonardo-da-vinci': 'Liam',   // Italian accent
      'cleopatra': 'Sarah',          // Egyptian/Mediterranean
      'socrates': 'Daniel',          // Greek accent
      'shakespeare': 'Will',         // Classic English
      'napoleon': 'Roger',           // French accent
      'abraham-lincoln': 'Brian',    // American
      'julius-caesar': 'George',     // Latin/Roman authority
      'joan-of-arc': 'Charlotte',    // French
      'galileo': 'Liam'              // Italian
    };

    return voiceMap[figure.id] || 'Aria';
  };

  const toggleAudio = () => {
    if (currentAudio) {
      if (isPlayingAudio) {
        currentAudio.pause();
        setIsPlayingAudio(false);
      } else {
        currentAudio.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const searchWikipedia = async (query: string) => {
    try {
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/wikipedia-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('Wikipedia search failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      return null;
    }
  };

  const searchYoutube = async (query: string) => {
    try {
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/youtube-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxResults: 3 }),
      });

      const data = await response.json();
      
      if (data.success) {
        return data.results;
      } else {
        console.error('YouTube search failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return null;
    }
  };

  const handleYoutubeSearch = async (query: string) => {
    const youtubeResults = await searchYoutube(query);
    if (youtubeResults && youtubeResults.length > 0) {
      const videoLinks = youtubeResults
        .slice(0, 3)
        .map((video: any) => `🎥 **${video.title}**\n${video.description.substring(0, 100)}...\n[Watch on YouTube](${video.url})`)
        .join('\n\n---\n\n');

      const searchMessage: Message = {
        id: Date.now().toString(),
        content: `🎬 **YouTube Search Results for "${query}"**\n\n${videoLinks}`,
        type: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, searchMessage]);

      // If this is a search for the current figure, suggest using authentic recordings
      if (selectedFigure && query.toLowerCase().includes(selectedFigure.name.toLowerCase())) {
        const authenticity = youtubeResults.find((video: any) => video.hasOriginalVoice);
        if (authenticity) {
          const suggestionMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `💡 **Voice Authenticity Tip**: I found recordings that may contain ${selectedFigure.name}'s actual voice! While I use a regional accent for text-to-speech, you can listen to these recordings to hear the authentic voice and speaking patterns.`,
            type: "assistant",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, suggestionMessage]);
        }
      }
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Historical Avatars</h1>
          
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowFileUpload(!showFileUpload)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const query = prompt('Search Wikipedia for:');
                  if (query) handleWikipediaSearch(query);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Search Wikipedia
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const figName = selectedFigure?.name || '';
                  const query = prompt('Search YouTube for historical recordings:', `${figName} speech original recording`);
                  if (query) handleYoutubeSearch(query);
                }}
              >
                <Play className="mr-2 h-4 w-4" />
                Find Voice Recordings
              </Button>

              {showFileUpload && (
                <Card className="p-4">
                  <FileUpload onFileUpload={(files) => console.log('Files uploaded:', files)} />
                </Card>
              )}

            <div>
              <h3 className="font-semibold mb-3">Select Historical Figure</h3>
              <AvatarSelector 
                selectedFigure={selectedFigure}
                onSelectFigure={setSelectedFigure}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          {selectedFigure ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{selectedFigure.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedFigure.period}</p>
              </div>
              {currentAudio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAudio}
                  className="ml-2"
                >
                  {isPlayingAudio ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-muted-foreground">
              Select a historical figure to start chatting
            </h2>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1">
          <ChatMessages 
            messages={messages} 
            selectedFigure={selectedFigure}
            isLoading={isLoading}
          />
        </div>

        {/* Input */}
        {selectedFigure && (
          <div className="border-t border-border bg-card p-4">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Ask ${selectedFigure.name} anything...`}
                  className="min-h-[60px] resize-none pr-12"
                  disabled={isLoading}
                />
                <Button
                  onClick={toggleVoiceRecognition}
                  disabled={isLoading}
                  variant="ghost"
                  size="sm"
                  className={`absolute right-2 top-2 h-8 w-8 ${isListening ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {isListening && (
              <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                🎤 Listening... Speak now
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalChat;