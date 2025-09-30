import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, MessageCircle, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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

interface ConversationHistoryProps {
  onSelectConversation: (conversation: Conversation) => void;
  selectedFigureId?: string;
  onConversationDelete?: () => void;
}

export default function ConversationHistory({ onSelectConversation, selectedFigureId, onConversationDelete }: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, [selectedFigureId]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('conversations')
        .select(`
          *,
          messages(count)
        `)
        .order('updated_at', { ascending: false });

      if (selectedFigureId) {
        query = query.eq('figure_id', selectedFigureId);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      // Process the data to include message count
      const processedData = data?.map(conv => ({
        ...conv,
        message_count: conv.messages?.[0]?.count || 0
      })) || [];

      setConversations(processedData);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Notify parent component about deletion
      onConversationDelete?.();
      
      toast({
        title: "Success",
        description: "Conversation deleted",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const clearAllConversations = async () => {
    try {
      let query = supabase.from('conversations').delete();
      
      if (selectedFigureId) {
        query = query.eq('figure_id', selectedFigureId);
      } else {
        query = query.neq('id', ''); // Delete all if no specific figure
      }

      const { error } = await query;

      if (error) throw error;

      // Clear the local state immediately
      setConversations([]);
      
      // Notify parent component about deletion
      onConversationDelete?.();
      
      // Reload to ensure we have the latest data
      await loadConversations();
      
      toast({
        title: "Success",
        description: selectedFigureId ? "All conversations for this figure cleared" : "All conversations cleared",
      });
    } catch (error) {
      console.error('Error clearing conversations:', error);
      toast({
        title: "Error",
        description: "Failed to clear conversations",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
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

  return (
    <Card className="p-4">
      <div className="flex items-center space-x-2 mb-4">
        <History className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">
          {selectedFigureId ? 'Figure History' : 'All Conversations'}
        </h3>
        <div className="flex items-center space-x-2 ml-auto">
          <Badge variant="secondary">
            {conversations.length}
          </Badge>
          {conversations.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllConversations}
              className="text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-64">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Start chatting to create history</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="group p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {conversation.figure_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {conversation.language.split('-')[1]}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.title || 'Untitled conversation'}
                    </p>
                    
                    <div className="flex items-center space-x-2 mt-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(conversation.updated_at)}
                      </span>
                      <MessageCircle className="h-3 w-3 text-muted-foreground ml-2" />
                      <span className="text-xs text-muted-foreground">
                        {conversation.message_count} messages
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}