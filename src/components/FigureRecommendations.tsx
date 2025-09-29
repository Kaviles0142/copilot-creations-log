import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, ArrowRight } from "lucide-react";
import { HistoricalFigure } from "./HistoricalChat";

interface FigureRecommendationsProps {
  selectedFigure: HistoricalFigure | null;
  onSelectFigure: (figure: HistoricalFigure) => void;
}

const FigureRecommendations = ({ selectedFigure, onSelectFigure }: FigureRecommendationsProps) => {
  const getRecommendations = (figure: HistoricalFigure | null): HistoricalFigure[] => {
    if (!figure) return [];

    const allFigures: Record<string, HistoricalFigure[]> = {
      // Scientists & Inventors
      "albert-einstein": [
        { id: "isaac-newton", name: "Isaac Newton", period: "1643-1727", description: "Physicist and mathematician", avatar: "⚛️" },
        { id: "galileo-galilei", name: "Galileo Galilei", period: "1564-1642", description: "Astronomer and physicist", avatar: "🔭" },
        { id: "nikola-tesla", name: "Nikola Tesla", period: "1856-1943", description: "Inventor and electrical engineer", avatar: "⚡" }
      ],
      
      // Musicians
      "wolfgang-amadeus-mozart": [
        { id: "ludwig-van-beethoven", name: "Ludwig van Beethoven", period: "1770-1827", description: "Classical composer", avatar: "🎵" },
        { id: "johann-sebastian-bach", name: "Johann Sebastian Bach", period: "1685-1750", description: "Baroque composer", avatar: "🎹" },
        { id: "frederic-chopin", name: "Frédéric Chopin", period: "1810-1849", description: "Romantic composer and pianist", avatar: "🎼" }
      ],
      
      "hendrix": [
        { id: "bob-dylan", name: "Bob Dylan", period: "1941-present", description: "Singer-songwriter", avatar: "🎤" },
        { id: "john-lennon", name: "John Lennon", period: "1940-1980", description: "Musician and peace activist", avatar: "🎸" },
        { id: "elvis-presley", name: "Elvis Presley", period: "1935-1977", description: "King of Rock and Roll", avatar: "🕺" }
      ],
      
      // Writers & Philosophers
      "william-shakespeare": [
        { id: "charles-dickens", name: "Charles Dickens", period: "1812-1870", description: "Victorian novelist", avatar: "📚" },
        { id: "jane-austen", name: "Jane Austen", period: "1775-1817", description: "English novelist", avatar: "✍️" },
        { id: "oscar-wilde", name: "Oscar Wilde", period: "1854-1900", description: "Irish poet and playwright", avatar: "🎭" }
      ],
      
      "socrates": [
        { id: "plato", name: "Plato", period: "428-348 BC", description: "Ancient Greek philosopher", avatar: "🏛️" },
        { id: "aristotle", name: "Aristotle", period: "384-322 BC", description: "Ancient Greek philosopher", avatar: "📜" },
        { id: "confucius", name: "Confucius", period: "551-479 BC", description: "Chinese philosopher", avatar: "🧘" }
      ],
      
      // Leaders & Rulers
      "napoleon-bonaparte": [
        { id: "julius-caesar", name: "Julius Caesar", period: "100-44 BC", description: "Roman general and statesman", avatar: "🏺" },
        { id: "alexander-the-great", name: "Alexander the Great", period: "356-323 BC", description: "Macedonian king and conqueror", avatar: "⚔️" },
        { id: "winston-churchill", name: "Winston Churchill", period: "1874-1965", description: "British Prime Minister", avatar: "🇬🇧" }
      ],
      
      "cleopatra-vii": [
        { id: "nefertiti", name: "Nefertiti", period: "1370-1330 BC", description: "Egyptian queen", avatar: "👸" },
        { id: "hatshepsut", name: "Hatshepsut", period: "1507-1458 BC", description: "Female pharaoh of Egypt", avatar: "🦅" },
        { id: "elizabeth-i", name: "Elizabeth I", period: "1533-1603", description: "Queen of England", avatar: "👑" }
      ],
      
      // Artists & Polymaths
      "leonardo-da-vinci": [
        { id: "michelangelo", name: "Michelangelo", period: "1475-1564", description: "Renaissance artist and sculptor", avatar: "🎨" },
        { id: "raphael", name: "Raphael", period: "1483-1520", description: "Renaissance painter", avatar: "🖼️" },
        { id: "pablo-picasso", name: "Pablo Picasso", period: "1881-1973", description: "Spanish painter and sculptor", avatar: "🎭" }
      ]
    };

    return allFigures[figure.id] || [];
  };

  const recommendations = getRecommendations(selectedFigure);

  if (!selectedFigure || recommendations.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4" />
        <h3 className="font-semibold text-sm">You might also like</h3>
      </div>
      
      <div className="space-y-2">
        {recommendations.map((figure) => (
          <div
            key={figure.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
            onClick={() => onSelectFigure(figure)}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">
                {figure.avatar}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{figure.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="truncate">{figure.period}</span>
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-3">
        Based on your interest in {selectedFigure.name}
      </p>
    </Card>
  );
};

export default FigureRecommendations;