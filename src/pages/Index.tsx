import { Suspense } from "react";
import HistoricalChat from "@/components/HistoricalChat";

const Index = () => {
  console.log("Index page loading...");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-4">
          <p className="text-muted-foreground text-center">Chat with history in their authentic voice</p>
        </div>
        
        <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
          <HistoricalChat />
        </Suspense>
      </div>
    </div>
  );
};

export default Index;
