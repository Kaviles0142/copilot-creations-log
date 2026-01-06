import { Suspense, useState } from "react";
import HistoricalChat from "@/components/HistoricalChat";
import DebateMode from "@/components/DebateMode";
import PodcastMode from "@/components/PodcastMode";
import { Button } from "@/components/ui/button";
import { Users, Mic, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const OldApp = () => {
  console.log("Old app page loading...");
  const [mode, setMode] = useState<"chat" | "debate" | "podcast">("chat");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        {/* Back Link */}
        <div className="mb-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to new experience</span>
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-center mb-2">Historical AI Experience</h1>
          <p className="text-muted-foreground text-center">Chat with history in their authentic voice</p>
          <p className="text-xs text-muted-foreground text-center mt-1">Kimi K2 primary AI provider</p>
          <p className="text-xs text-accent text-center mt-1">(Legacy Version)</p>
          
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant={mode === "chat" ? "default" : "outline"}
              onClick={() => setMode("chat")}
            >
              Single Chat
            </Button>
            <Button
              variant={mode === "debate" ? "default" : "outline"}
              onClick={() => setMode("debate")}
            >
              <Users className="mr-2 h-4 w-4" />
              Debate Mode
            </Button>
            <Button
              variant={mode === "podcast" ? "default" : "outline"}
              onClick={() => setMode("podcast")}
            >
              <Mic className="mr-2 h-4 w-4" />
              Podcast Mode
            </Button>
          </div>
        </div>
        
        <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
          {mode === "chat" ? (
            <HistoricalChat />
          ) : mode === "debate" ? (
            <DebateMode />
          ) : (
            <PodcastMode />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default OldApp;
