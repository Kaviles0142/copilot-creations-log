import { Suspense, useState } from "react";
import HistoricalChat from "@/components/HistoricalChat";
import DebateMode from "@/components/DebateMode";
import PodcastMode from "@/components/PodcastMode";
import { Button } from "@/components/ui/button";
import { Users, Mic } from "lucide-react";

const Index = () => {
  console.log("Index page loading...");
  const [mode, setMode] = useState<"chat" | "debate" | "podcast">("chat");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-center mb-2">Historical AI Experience</h1>
          <p className="text-muted-foreground text-center">Chat with history in their authentic voice</p>
          
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

export default Index;
