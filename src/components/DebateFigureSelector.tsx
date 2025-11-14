import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Sparkles, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Figure {
  id: string;
  name: string;
}

interface DebateFigureSelectorProps {
  onStartDebate: (topic: string, figures: Figure[]) => void;
}

export default function DebateFigureSelector({ onStartDebate }: DebateFigureSelectorProps) {
  const [topic, setTopic] = useState("");
  const [selectedFigures, setSelectedFigures] = useState<Figure[]>([]);
  const [figureInput, setFigureInput] = useState("");

  const addFigure = () => {
    const name = figureInput.trim();
    if (!name) {
      toast.error("Please enter a name");
      return;
    }
    if (selectedFigures.length >= 4) {
      toast.error("Maximum 4 figures allowed");
      return;
    }
    if (selectedFigures.find(f => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Figure already added");
      return;
    }

    const id = name.toLowerCase().replace(/\s+/g, '-');
    setSelectedFigures([...selectedFigures, { id, name }]);
    setFigureInput("");
  };

  const removeFigure = (id: string) => {
    setSelectedFigures(selectedFigures.filter(f => f.id !== id));
  };

  const canStart = topic.trim() && selectedFigures.length >= 2;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Setup Debate</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Debate Topic</Label>
          <Input
            id="topic"
            placeholder="e.g., Should humanity colonize Mars?"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="figure-input">Add Historical Figures (2-4)</Label>
          <p className="text-sm text-muted-foreground">
            Enter any historical figure's name - {selectedFigures.length}/4 added
          </p>
          
          <div className="flex gap-2">
            <Input
              id="figure-input"
              placeholder="e.g., Abraham Lincoln, Marie Curie..."
              value={figureInput}
              onChange={(e) => setFigureInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFigure()}
            />
            <Button 
              onClick={addFigure}
              disabled={selectedFigures.length >= 4}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {selectedFigures.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50">
              {selectedFigures.map((figure) => (
                <Badge key={figure.id} variant="secondary" className="gap-1 px-3 py-1">
                  {figure.name}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeFigure(figure.id)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={() => onStartDebate(topic, selectedFigures)}
          disabled={!canStart}
          className="w-full"
          size="lg"
        >
          <Users className="mr-2 h-4 w-4" />
          Start Debate
        </Button>
      </div>
    </Card>
  );
}