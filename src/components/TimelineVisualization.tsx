import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Music, Palette, Crown, Scroll, Globe } from "lucide-react";
import { HistoricalFigure } from "./HistoricalChat";

interface TimelineVisualizationProps {
  selectedFigure: HistoricalFigure | null;
  onSelectFigure: (figure: HistoricalFigure) => void;
}

const timelineFigures: (HistoricalFigure & { year: number; category: string })[] = [
  // Ancient Times
  { id: "confucius", name: "Confucius", period: "551-479 BC", description: "Chinese philosopher", avatar: "🧘", year: -500, category: "Philosophy" },
  { id: "socrates", name: "Socrates", period: "470-399 BC", description: "Greek philosopher", avatar: "🏛️", year: -400, category: "Philosophy" },
  { id: "aristotle", name: "Aristotle", period: "384-322 BC", description: "Greek philosopher", avatar: "📜", year: -350, category: "Philosophy" },
  { id: "cleopatra", name: "Cleopatra VII", period: "69-30 BC", description: "Last pharaoh of Egypt", avatar: "👑", year: -50, category: "Leadership" },
  
  // Renaissance
  { id: "leonardo", name: "Leonardo da Vinci", period: "1452-1519", description: "Renaissance polymath", avatar: "🎨", year: 1500, category: "Art" },
  { id: "shakespeare", name: "William Shakespeare", period: "1564-1616", description: "English playwright", avatar: "🎭", year: 1600, category: "Literature" },
  { id: "galileo", name: "Galileo Galilei", period: "1564-1642", description: "Astronomer", avatar: "🔭", year: 1610, category: "Science" },
  
  // Classical Music Era
  { id: "bach", name: "Johann Sebastian Bach", period: "1685-1750", description: "Baroque composer", avatar: "🎹", year: 1720, category: "Music" },
  { id: "mozart", name: "Wolfgang Amadeus Mozart", period: "1756-1791", description: "Classical composer", avatar: "🎵", year: 1780, category: "Music" },
  { id: "beethoven", name: "Ludwig van Beethoven", period: "1770-1827", description: "Classical composer", avatar: "🎼", year: 1800, category: "Music" },
  
  // Modern Era
  { id: "napoleon", name: "Napoleon Bonaparte", period: "1769-1821", description: "French emperor", avatar: "⚔️", year: 1810, category: "Leadership" },
  { id: "einstein", name: "Albert Einstein", period: "1879-1955", description: "Physicist", avatar: "⚛️", year: 1920, category: "Science" },
  { id: "hendrix", name: "Jimi Hendrix", period: "1942-1970", description: "Rock guitarist", avatar: "🎸", year: 1970, category: "Music" },
];

const categories = {
  "Philosophy": { icon: Scroll, color: "bg-purple-100 text-purple-700 border-purple-200" },
  "Leadership": { icon: Crown, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "Art": { icon: Palette, color: "bg-pink-100 text-pink-700 border-pink-200" },
  "Literature": { icon: Globe, color: "bg-green-100 text-green-700 border-green-200" },
  "Science": { icon: Globe, color: "bg-blue-100 text-blue-700 border-blue-200" },
  "Music": { icon: Music, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

const TimelineVisualization = ({ selectedFigure, onSelectFigure }: TimelineVisualizationProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFigures = selectedCategory 
    ? timelineFigures.filter(f => f.category === selectedCategory)
    : timelineFigures;

  const sortedFigures = [...filteredFigures].sort((a, b) => a.year - b.year);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Historical Timeline</h3>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1 mb-4">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="text-xs h-7"
        >
          All
        </Button>
        {Object.entries(categories).map(([category, config]) => {
          const Icon = config.icon;
          return (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="text-xs h-7"
            >
              <Icon className="h-3 w-3 mr-1" />
              {category}
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
        
        <div className="space-y-4">
          {sortedFigures.map((figure, index) => {
            const isSelected = selectedFigure?.id === figure.id;
            const categoryConfig = categories[figure.category as keyof typeof categories];
            const Icon = categoryConfig.icon;
            
            return (
              <div
                key={figure.id}
                className={`relative flex items-center cursor-pointer group ${
                  isSelected ? 'scale-105' : 'hover:scale-102'
                } transition-transform`}
                onClick={() => onSelectFigure(figure)}
              >
                {/* Timeline Dot */}
                <div className={`w-3 h-3 rounded-full border-2 z-10 ${
                  isSelected 
                    ? 'bg-primary border-primary' 
                    : 'bg-background border-border group-hover:border-primary'
                }`}></div>
                
                {/* Figure Card */}
                <div className={`ml-4 p-3 rounded-lg border flex-1 ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border bg-card group-hover:border-primary/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${categoryConfig.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{figure.name}</p>
                        <p className="text-xs text-muted-foreground">{figure.period}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {figure.year > 0 ? `${figure.year} AD` : `${Math.abs(figure.year)} BC`}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{figure.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Click any figure to start a conversation across time
      </p>
    </Card>
  );
};

export default TimelineVisualization;