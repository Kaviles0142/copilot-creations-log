import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Sparkles, Plus, X, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Figure {
  id: string;
  name: string;
}

type DebateFormat = "round-robin" | "free-for-all" | "moderated";

interface DebateFigureSelectorProps {
  onStartDebate: (topic: string, figures: Figure[], format: DebateFormat, language: string) => void;
}

const LANGUAGES = [
  { code: "en-US", name: "🇺🇸 English" },
  { code: "es-ES", name: "🇪🇸 Español (Spanish)" },
  { code: "fr-FR", name: "🇫🇷 Français (French)" },
  { code: "de-DE", name: "🇩🇪 Deutsch (German)" },
  { code: "it-IT", name: "🇮🇹 Italiano (Italian)" },
  { code: "pt-PT", name: "🇵🇹 Português (Portuguese)" },
  { code: "ja-JP", name: "🇯🇵 日本語 (Japanese)" },
  { code: "zh-CN", name: "🇨🇳 中文 (Chinese)" },
  { code: "ko-KR", name: "🇰🇷 한국어 (Korean)" },
  { code: "ar-SA", name: "🇸🇦 العربية (Arabic)" },
  { code: "ru-RU", name: "🇷🇺 Русский (Russian)" },
  { code: "hi-IN", name: "🇮🇳 हिन्दी (Hindi)" },
];

export default function DebateFigureSelector({ onStartDebate }: DebateFigureSelectorProps) {
  const [topic, setTopic] = useState("");
  const [selectedFigures, setSelectedFigures] = useState<Figure[]>([]);
  const [figureInput, setFigureInput] = useState("");
  const [format, setFormat] = useState<DebateFormat>("round-robin");
  const [language, setLanguage] = useState("en-US");
  const [isSearching, setIsSearching] = useState(false);

  const addFigure = async () => {
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

    setIsSearching(true);
    try {
      // Validate figure via wikipedia-search (with DuckDuckGo fallback)
      const { data, error } = await supabase.functions.invoke('wikipedia-search', {
        body: { query: name, limit: 1 }
      });

      if (error) {
        console.error('Wikipedia search error:', error);
      }

      // Use validated name if found, otherwise use input as-is
      const validatedName = data?.data?.title || name;
      const id = validatedName.toLowerCase().replace(/\s+/g, '-');
      
      // Check again for duplicates with validated name
      if (selectedFigures.find(f => f.id === id)) {
        toast.error("Figure already added");
        setIsSearching(false);
        return;
      }

      setSelectedFigures([...selectedFigures, { id, name: validatedName }]);
      setFigureInput("");
      
      if (data?.data?.title) {
        toast.success(`Found: ${validatedName}`);
      }
    } catch (err) {
      console.error('Error validating figure:', err);
      // Fallback to using input directly
      const id = name.toLowerCase().replace(/\s+/g, '-');
      setSelectedFigures([...selectedFigures, { id, name }]);
      setFigureInput("");
    } finally {
      setIsSearching(false);
    }
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

        <div className="space-y-2">
          <Label htmlFor="format">Debate Format</Label>
          <Select value={format} onValueChange={(value) => setFormat(value as DebateFormat)}>
            <SelectTrigger id="format" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="round-robin">Round-Robin - Each figure takes turns in order</SelectItem>
              <SelectItem value="free-for-all">Free-for-All - AI decides who responds based on context</SelectItem>
              <SelectItem value="moderated">Moderated - You control who speaks</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {format === "round-robin" && "Figures will speak one after another in sequence"}
            {format === "free-for-all" && "The AI will pick the most relevant figure to respond"}
            {format === "moderated" && "Click on a figure's avatar to make them speak"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Response Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="language" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50 max-h-[300px]">
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Figures will respond in this language
          </p>
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
              onKeyDown={(e) => e.key === 'Enter' && !isSearching && addFigure()}
              disabled={isSearching}
            />
            <Button 
              onClick={addFigure}
              disabled={selectedFigures.length >= 4 || isSearching}
              size="icon"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
          onClick={() => onStartDebate(topic, selectedFigures, format, language)}
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