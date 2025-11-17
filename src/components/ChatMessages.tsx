import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Bot } from "lucide-react";
import { Message, HistoricalFigure } from "./HistoricalChat";
import { SourcesIndicator } from "./SourcesIndicator";

interface ChatMessagesProps {
  messages: Message[];
  selectedFigure: HistoricalFigure | null;
  isLoading: boolean;
}

const ChatMessages = ({ messages, selectedFigure, isLoading }: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (!selectedFigure) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Welcome to Historical Avatars</h3>
            <p className="text-muted-foreground">
              Select a historical figure from the sidebar to start a conversation through time
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4 max-w-4xl mx-auto">
        {messages.length === 0 && (
          <Card className="p-6 text-center">
            <Bot className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Start a conversation with {selectedFigure.name}</h3>
            <p className="text-muted-foreground">
              Ask about their life, times, thoughts, or anything you're curious about from their era.
            </p>
          </Card>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent text-accent-foreground'
                }`}>
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                
                <Card className={`p-4 ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">
                        {message.type === 'user' ? 'You' : (message.speakerName || selectedFigure.name)}
                      </span>
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </Card>
              </div>
            </div>
            
            {/* Show sources indicator for assistant messages */}
            {message.type === 'assistant' && message.sourcesUsed && (
              <div className="mt-2 ml-11">
                <SourcesIndicator 
                  sourcesUsed={message.sourcesUsed} 
                  isVisible={true} 
                />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex space-x-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">{selectedFigure?.name}</span>
                    <span className="text-xs text-muted-foreground">thinking...</span>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

export default ChatMessages;