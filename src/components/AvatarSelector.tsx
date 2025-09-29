import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Scroll, Sword, Globe } from "lucide-react";
import { HistoricalFigure } from "./HistoricalChat";

interface AvatarSelectorProps {
  selectedFigure: HistoricalFigure | null;
  onSelectFigure: (figure: HistoricalFigure) => void;
}

const historicalFigures: HistoricalFigure[] = [
  {
    id: "shakespeare",
    name: "William Shakespeare",
    period: "Renaissance (1564-1616)",
    description: "English playwright and poet",
    avatar: "🎭"
  },
  {
    id: "cleopatra",
    name: "Cleopatra VII",
    period: "Ancient Egypt (69-30 BC)",
    description: "Last pharaoh of Ancient Egypt",
    avatar: "👑"
  },
  {
    id: "leonardo",
    name: "Leonardo da Vinci", 
    period: "Renaissance (1452-1519)",
    description: "Artist, inventor, and polymath",
    avatar: "🎨"
  },
  {
    id: "napoleon",
    name: "Napoleon Bonaparte",
    period: "Early 19th Century (1769-1821)",
    description: "French military leader and emperor",
    avatar: "⚔️"
  },
  {
    id: "socrates",
    name: "Socrates",
    period: "Ancient Greece (470-399 BC)",
    description: "Classical Greek philosopher",
    avatar: "🏛️"
  },
  {
    id: "elizabeth",
    name: "Elizabeth I",
    period: "Tudor England (1533-1603)",
    description: "Queen of England and Ireland",
    avatar: "🏰"
  }
];

const getIcon = (figureId: string) => {
  switch (figureId) {
    case "cleopatra":
    case "elizabeth":
      return Crown;
    case "shakespeare":
    case "socrates":
      return Scroll;
    case "napoleon":
      return Sword;
    case "leonardo":
      return Globe;
    default:
      return Scroll;
  }
};

const AvatarSelector = ({ selectedFigure, onSelectFigure }: AvatarSelectorProps) => {
  return (
    <div className="space-y-2">
      {historicalFigures.map((figure) => {
        const Icon = getIcon(figure.id);
        const isSelected = selectedFigure?.id === figure.id;
        
        return (
          <Card 
            key={figure.id}
            className={`p-3 cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent'
            }`}
            onClick={() => onSelectFigure(figure)}
          >
            <div className="flex items-start space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent'
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{figure.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{figure.period}</p>
                <p className="text-xs text-muted-foreground mt-1">{figure.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default AvatarSelector;