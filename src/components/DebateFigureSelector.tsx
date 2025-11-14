import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Sparkles } from "lucide-react";

interface Figure {
  id: string;
  name: string;
}

const POPULAR_FIGURES: Figure[] = [
  { id: "abraham-lincoln", name: "Abraham Lincoln" },
  { id: "marie-curie", name: "Marie Curie" },
  { id: "albert-einstein", name: "Albert Einstein" },
  { id: "winston-churchill", name: "Winston Churchill" },
  { id: "cleopatra", name: "Cleopatra" },
  { id: "leonardo-da-vinci", name: "Leonardo da Vinci" },
  { id: "nelson-mandela", name: "Nelson Mandela" },
  { id: "ada-lovelace", name: "Ada Lovelace" },
];

interface DebateFigureSelectorProps {
  onStartDebate: (topic: string, figures: Figure[]) => void;
}

export default function DebateFigureSelector({ onStartDebate }: DebateFigureSelectorProps) {
  const [topic, setTopic] = useState("");
  const [selectedFigures, setSelectedFigures] = useState<Figure[]>([]);

  const toggleFigure = (figure: Figure) => {
    if (selectedFigures.find(f => f.id === figure.id)) {
      setSelectedFigures(selectedFigures.filter(f => f.id !== figure.id));
    } else if (selectedFigures.length < 4) {
      setSelectedFigures([...selectedFigures, figure]);
    }
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
          <Label>Select 2-4 Historical Figures</Label>
          <p className="text-sm text-muted-foreground">
            Choose {selectedFigures.length}/4 figures
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {POPULAR_FIGURES.map((figure) => {
              const isSelected = selectedFigures.find(f => f.id === figure.id);
              const isDisabled = !isSelected && selectedFigures.length >= 4;
              
              return (
                <div
                  key={figure.id}
                  className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !isDisabled && toggleFigure(figure)}
                >
                  <Checkbox
                    checked={!!isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => !isDisabled && toggleFigure(figure)}
                  />
                  <span className="text-sm font-medium">{figure.name}</span>
                </div>
              );
            })}
          </div>
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