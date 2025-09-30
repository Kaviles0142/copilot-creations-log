import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { User, MessageCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ConversationHistory from "./ConversationHistory";

interface FigureWithConversations {
  figure_id: string;
  figure_name: string;
  conversation_count: number;
  last_conversation: string;
}

interface Conversation {
  id: string;
  figure_name: string;
  figure_id: string;
  title: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface FigureListProps {
  onSelectConversation: (conversation: Conversation) => void;
}

export default function FigureList({ onSelectConversation }: FigureListProps) {
  const [figures, setFigures] = useState<FigureWithConversations[]>([]);
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFigures();
  }, []);

  const loadFigures = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('conversations')
        .select('figure_id, figure_name, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Group conversations by figure and count them
      const figureMap = new Map<string, FigureWithConversations>();
      
      data?.forEach(conversation => {
        const existing = figureMap.get(conversation.figure_id);
        if (existing) {
          existing.conversation_count += 1;
          // Keep the most recent conversation date
          if (new Date(conversation.updated_at) > new Date(existing.last_conversation)) {
            existing.last_conversation = conversation.updated_at;
          }
        } else {
          figureMap.set(conversation.figure_id, {
            figure_id: conversation.figure_id,
            figure_name: conversation.figure_name,
            conversation_count: 1,
            last_conversation: conversation.updated_at
          });
        }
      });

      // Convert to array and sort by most recent conversation
      const figuresArray = Array.from(figureMap.values())
        .sort((a, b) => new Date(b.last_conversation).getTime() - new Date(a.last_conversation).getTime());

      setFigures(figuresArray);
    } catch (error) {
      console.error('Error loading figures:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    onSelectConversation(conversation);
  };

  const handleConversationDelete = () => {
    // Refresh the figures list when a conversation is deleted
    loadFigures();
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  // Show conversations for selected figure
  if (selectedFigureId) {
    return (
      <Card className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedFigureId(null)}
            className="p-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h3 className="font-semibold">
              {figures.find(f => f.figure_id === selectedFigureId)?.figure_name} Conversations
            </h3>
          </div>
        </div>

        <ConversationHistory
          selectedFigureId={selectedFigureId}
          onSelectConversation={handleConversationSelect}
          onConversationDelete={handleConversationDelete}
        />
      </Card>
    );
  }

  // Show list of figures
  return (
    <Card className="p-4">
      <div className="flex items-center space-x-2 mb-4">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">👥 All People Chatted With</h3>
        <Badge variant="secondary" className="ml-auto">
          {figures.length} {figures.length === 1 ? 'person' : 'people'}
        </Badge>
      </div>

      <ScrollArea className="h-64">
        {figures.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Start chatting with a historical figure</p>
          </div>
        ) : (
          <div className="space-y-2">
            {figures.map((figure) => (
              <div
                key={figure.figure_id}
                className="group p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedFigureId(figure.figure_id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {figure.figure_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      <span>
                        {figure.conversation_count} {figure.conversation_count === 1 ? 'conversation' : 'conversations'}
                      </span>
                      <span>•</span>
                      <span>{formatDate(figure.last_conversation)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
