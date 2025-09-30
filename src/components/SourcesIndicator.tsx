import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, BookOpen, FileText, Video, Globe, Calendar, Scroll, Search } from "lucide-react";
import { useState } from "react";

interface SourcesUsed {
  books: number;
  documents: number;
  youtube: number;
  wikipedia: boolean;
  currentEvents: number;
  historicalContext: number;
  webArticles: number;
}

interface SourcesIndicatorProps {
  sourcesUsed: SourcesUsed;
  isVisible: boolean;
}

export const SourcesIndicator = ({ sourcesUsed, isVisible }: SourcesIndicatorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isVisible) return null;

  const totalSources = 
    sourcesUsed.books + 
    sourcesUsed.documents + 
    sourcesUsed.youtube + 
    (sourcesUsed.wikipedia ? 1 : 0) + 
    sourcesUsed.currentEvents + 
    sourcesUsed.historicalContext + 
    sourcesUsed.webArticles;

  // Only show if there are meaningful sources (more than just basic lookup)
  if (totalSources <= 1) return null;

  return (
    <Card className="mb-4 border-green-200 bg-green-50/50 dark:bg-green-900/20 dark:border-green-800">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-green-100/50 dark:hover:bg-green-900/30 rounded transition-colors">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                ✅ Enhanced with {totalSources} information sources
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-green-600 dark:text-green-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sourcesUsed.books > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <BookOpen className="h-3 w-3" />
                  {sourcesUsed.books} Book{sourcesUsed.books > 1 ? 's' : ''}
                </Badge>
              )}
              
              {sourcesUsed.documents > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  {sourcesUsed.documents} Document{sourcesUsed.documents > 1 ? 's' : ''}
                </Badge>
              )}
              
              {sourcesUsed.youtube > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <Video className="h-3 w-3" />
                  {sourcesUsed.youtube} Video{sourcesUsed.youtube > 1 ? 's' : ''}
                </Badge>
              )}
              
              {sourcesUsed.wikipedia && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <Globe className="h-3 w-3" />
                  Wikipedia
                </Badge>
              )}
              
              {sourcesUsed.currentEvents > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {sourcesUsed.currentEvents} Current Event{sourcesUsed.currentEvents > 1 ? 's' : ''}
                </Badge>
              )}
              
              {sourcesUsed.historicalContext > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <Scroll className="h-3 w-3" />
                  {sourcesUsed.historicalContext} Historical Context
                </Badge>
              )}
              
              {sourcesUsed.webArticles > 0 && (
                <Badge variant="secondary" className="justify-start gap-1 text-xs">
                  <Search className="h-3 w-3" />
                  {sourcesUsed.webArticles} Web Article{sourcesUsed.webArticles > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              This response was enhanced with real-time information, scholarly sources, and historical documentation.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};