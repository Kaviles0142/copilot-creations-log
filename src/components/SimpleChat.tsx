import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SimpleChat = () => {
  console.log("SimpleChat component loading...");
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Historical Chat</h1>
        <p className="text-muted-foreground mb-4">Chat with historical figures</p>
        <div className="space-y-4">
          <input 
            type="text" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full p-2 border rounded"
          />
          <Button onClick={() => alert('Message: ' + message)}>
            Send Message
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SimpleChat;