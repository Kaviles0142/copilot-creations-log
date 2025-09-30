import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Clock, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { HistoricalFigure } from "./HistoricalChat";

interface HistoricalFigureSearchProps {
  selectedFigure: HistoricalFigure | null;
  onSelectFigure: (figure: HistoricalFigure) => void;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface WikipediaData {
  title: string;
  extract: string;
  url?: string;
  thumbnail?: string;
  description: string;
  searchResults?: SearchResult[];
}

const HistoricalFigureSearch = ({ selectedFigure, onSelectFigure }: HistoricalFigureSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WikipediaData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const extractPeriodFromText = (text: string): string => {
    // Look for date patterns like (1564-1616), born in 1564, died 1616, etc.
    const patterns = [
      /\((\d{3,4}[-–]\d{3,4})\)/,  // (1564-1616)
      /\((\d{3,4}[-–]\d{3,4}\s+[A-Z]{2,3})\)/, // (69-30 BC)
      /born\s+(\d{3,4})[,\s].*died\s+(\d{3,4})/i, // born 1564, died 1616
      /(\d{3,4})[,\s].*-[,\s]*(\d{3,4})/,  // 1564 - 1616
      /(\d{1,2}\s+\w+\s+\d{3,4})[,\s].*(\d{1,2}\s+\w+\s+\d{3,4})/, // 23 April 1564 - 23 April 1616
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1] && match[2]) {
          return `${match[1]}-${match[2]}`;
        } else if (match[1]) {
          return match[1];
        }
      }
    }

    // Look for century references
    const centuryMatch = text.match(/(\d{1,2})(st|nd|rd|th)\s+century/i);
    if (centuryMatch) {
      return `${centuryMatch[1]}${centuryMatch[2]} century`;
    }

    // Look for just a single year
    const yearMatch = text.match(/\b(\d{3,4})\b/);
    if (yearMatch) {
      return `Around ${yearMatch[1]}`;
    }

    return "Historical period";
  };

  const generateFigureId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const searchHistoricalFigure = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('wikipedia-search', {
        body: { 
          query: searchQuery,
          limit: 5
        }
      });

      if (error) throw error;

      if (data.success) {
        const results: WikipediaData[] = [];
        
        // Add main result if available
        if (data.data) {
          results.push(data.data);
        }

        // Add search results if available
        if (data.searchResults) {
          for (const result of data.searchResults.slice(0, 4)) {
            // Get detailed info for each search result
            try {
              const detailResponse = await supabase.functions.invoke('wikipedia-search', {
                body: { query: result.title }
              });
              
              if (detailResponse.data?.success && detailResponse.data.data) {
                results.push(detailResponse.data.data);
              }
            } catch (detailError) {
              console.error('Error getting detail for:', result.title, detailError);
            }
          }
        }

        setSearchResults(results);
        
        // Automatically select the first result if available
        if (results.length > 0) {
          selectFigure(results[0]);
          toast({
            title: "Found and selected!",
            description: `Ready to chat with ${results[0].title}`,
          });
        } else {
          toast({
            title: "No results found",
            description: "Try searching for a different historical figure",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for historical figures. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const selectFigure = (result: WikipediaData) => {
    const period = extractPeriodFromText(result.extract);
    
    const figure: HistoricalFigure = {
      id: generateFigureId(result.title),
      name: result.title,
      period: period,
      description: result.description || result.extract.substring(0, 100) + "...",
      avatar: "🎭" // Default avatar
    };

    onSelectFigure(figure);
    toast({
      title: "Figure Selected",
      description: `You can now chat with ${result.title}`,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchHistoricalFigure();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Input
          placeholder="Search any historical figure..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button 
          onClick={searchHistoricalFigure}
          disabled={isSearching || !searchQuery.trim()}
          size="icon"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {selectedFigure && (
        <Card className="p-4 border-primary bg-primary/5">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{selectedFigure.name}</h3>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{selectedFigure.period}</span>
                </div>
              </div>
              <p className="text-sm mt-1">{selectedFigure.description}</p>
            </div>
          </div>
        </Card>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Search Results:</h4>
          {searchResults.map((result, index) => (
            <Card 
              key={index}
              className="p-3 cursor-pointer transition-all hover:shadow-md hover:bg-accent"
              onClick={() => selectFigure(result)}
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{result.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {extractPeriodFromText(result.extract)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {result.extract.substring(0, 150)}...
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoricalFigureSearch;