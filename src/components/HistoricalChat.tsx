import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Send, User, Bot } from "lucide-react";
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
              <div>
                <h2 className="font-semibold">{selectedFigure.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedFigure.period}</p>
              </div>
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
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask ${selectedFigure.name} anything...`}
                className="min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalChat;