import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Message, HistoricalFigure } from "./HistoricalChat";

interface ConversationExportProps {
  messages: Message[];
  selectedFigure: HistoricalFigure | null;
}

const ConversationExport = ({ messages, selectedFigure }: ConversationExportProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const formatConversation = () => {
    const header = `Conversation with ${selectedFigure?.name || 'Historical Figure'}
${selectedFigure?.period ? `Period: ${selectedFigure.period}` : ''}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

---

`;

    const conversation = messages.map(msg => {
      const speaker = msg.type === 'user' ? 'You' : selectedFigure?.name || 'Assistant';
      const timestamp = msg.timestamp.toLocaleTimeString();
      return `[${timestamp}] ${speaker}: ${msg.content}`;
    }).join('\n\n');

    return header + conversation;
  };

  const downloadConversation = () => {
    const content = formatConversation();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${selectedFigure?.name?.replace(/\s+/g, '_') || 'historical_figure'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Conversation Downloaded",
      description: "Your conversation has been saved as a text file",
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatConversation());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied to Clipboard",
        description: "Conversation copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const shareConversation = async () => {
    const content = formatConversation();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Conversation with ${selectedFigure?.name}`,
          text: content,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  if (messages.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-sm">Export Conversation</h3>
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={downloadConversation} 
          variant="outline" 
          size="sm"
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        
        <Button 
          onClick={copyToClipboard} 
          variant="outline" 
          size="sm"
          className="flex-1"
        >
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        
        <Button 
          onClick={shareConversation} 
          variant="outline" 
          size="sm"
          className="flex-1"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        {messages.length} messages • Started {messages[0]?.timestamp.toLocaleTimeString()}
      </p>
    </Card>
  );
};

export default ConversationExport;