import HistoricalChat from "@/components/HistoricalChat";

const Index = () => {
  console.log("Index page loading...");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-center mb-2">Historical AI Experience</h1>
          <p className="text-muted-foreground text-center">Chat with history and clone authentic voices</p>
        </div>
        
        <HistoricalChat />
      </div>
    </div>
  );
};

export default Index;
