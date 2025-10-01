import { Suspense } from "react";
import HistoricalChat from "@/components/HistoricalChat";
import { FakeYouVoiceSelector } from "@/components/FakeYouVoiceSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  console.log("Index page loading...");

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
            <TabsTrigger value="voices">FakeYou Voices</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat">
            <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
              <HistoricalChat />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="voices">
            <FakeYouVoiceSelector />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
