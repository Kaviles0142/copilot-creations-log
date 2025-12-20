import { useState, useEffect } from "react";
import { Video, X, ChevronUp, ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VideoEntry {
  url: string;
  timestamp: number;
  figureName?: string;
}

const STORAGE_KEY = "video-history";
const MAX_ENTRIES = 50;

export const VideoHistoryWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videos, setVideos] = useState<VideoEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setVideos(JSON.parse(stored));
      } catch {
        setVideos([]);
      }
    }

    // Listen for new videos
    const handleNewVideo = (e: CustomEvent<{ url: string; figureName?: string }>) => {
      const newEntry: VideoEntry = {
        url: e.detail.url,
        timestamp: Date.now(),
        figureName: e.detail.figureName,
      };
      setVideos((prev) => {
        const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener("video-generated" as any, handleNewVideo);
    return () => window.removeEventListener("video-generated" as any, handleNewVideo);
  }, []);

  const clearHistory = () => {
    setVideos([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeEntry = (index: number) => {
    setVideos((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ? (
        <div className="bg-card border border-border rounded-lg shadow-lg w-80 max-h-96 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Video History</span>
              <span className="text-xs text-muted-foreground">({videos.length})</span>
            </div>
            <div className="flex items-center gap-1">
              {videos.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={clearHistory}
                  title="Clear all"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            {videos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No videos generated yet
              </p>
            ) : (
              <div className="space-y-1">
                {videos.map((video, index) => (
                  <div
                    key={`${video.timestamp}-${index}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {video.figureName || "Video"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(video.timestamp)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeEntry(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(video.url, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shadow-lg"
          onClick={() => setIsExpanded(true)}
        >
          <Video className="h-4 w-4" />
          <span>{videos.length}</span>
          <ChevronUp className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
