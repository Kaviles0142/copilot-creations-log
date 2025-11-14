import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DebateFigureSelector from "./DebateFigureSelector";
import DebateArena from "./DebateArena";
import { useToast } from "@/hooks/use-toast";

interface Figure {
  id: string;
  name: string;
}

export default function DebateMode() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [figures, setFigures] = useState<Figure[]>([]);
  const { toast } = useToast();

  const handleStartDebate = async (debateTopic: string, selectedFigures: Figure[]) => {
    try {
      const { data, error } = await supabase
        .from("debate_sessions")
        .insert({
          topic: debateTopic,
          figure_ids: selectedFigures.map(f => f.id),
          figure_names: selectedFigures.map(f => f.name),
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setTopic(debateTopic);
      setFigures(selectedFigures);

      toast({
        title: "Debate Started",
        description: "The historical figures are ready to debate!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start debate session",
        variant: "destructive",
      });
    }
  };

  const handleEndDebate = async () => {
    if (sessionId) {
      await supabase
        .from("debate_sessions")
        .update({ status: "completed" })
        .eq("id", sessionId);
    }
    
    setSessionId(null);
    setTopic("");
    setFigures([]);
  };

  if (sessionId) {
    return (
      <DebateArena
        sessionId={sessionId}
        topic={topic}
        figures={figures}
        onEnd={handleEndDebate}
      />
    );
  }

  return <DebateFigureSelector onStartDebate={handleStartDebate} />;
}