import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoricalChat from "@/components/HistoricalChat";
import VoiceCloningManager from "@/components/VoiceCloningManager";

const Index = () => {
  console.log("Index page loading...");
  const [selectedFigure] = useState("John F. Kennedy");
  const [selectedFigureId] = useState("jfk");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-center mb-2">Historical AI Experience</h1>
          <p className="text-muted-foreground text-center">Chat with history and clone authentic voices</p>
        </div>
        
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">Historical Chat</TabsTrigger>
            <TabsTrigger value="voice-clone">Voice Cloning</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="mt-6">
            <HistoricalChat />
          </TabsContent>
          
          <TabsContent value="voice-clone" className="mt-6">
            <VoiceCloningManager 
              figureName={selectedFigure}
              figureId={selectedFigureId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
