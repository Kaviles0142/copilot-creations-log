import { Suspense } from "react";
import HistoricalChat from "@/components/HistoricalChat";

const Index = () => {
  console.log("Index page loading...");

  return (
    <div className="h-full bg-background overflow-hidden">
      <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
        <HistoricalChat />
      </Suspense>
    </div>
  );
};

export default Index;
