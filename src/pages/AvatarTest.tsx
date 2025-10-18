import { useState } from 'react';
import { StreamingAvatar } from '@/components/StreamingAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const AvatarTest = () => {
  const [text, setText] = useState('');
  const [isReady, setIsReady] = useState(false);

  const handleSpeak = () => {
    if (text && (window as any).avatarSpeak) {
      (window as any).avatarSpeak(text);
      setText('');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-6">A2E Streaming Avatar Test</h1>
        
        <Card className="p-6 mb-4">
          <div className="aspect-video w-full mb-4">
            <StreamingAvatar 
              avatarId="676e1f054c86ff839eae2cc3"
              onReady={() => setIsReady(true)}
              onError={(error) => console.error('Avatar error:', error)}
            />
          </div>

          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text for avatar to speak..."
              onKeyDown={(e) => e.key === 'Enter' && handleSpeak()}
              disabled={!isReady}
            />
            <Button 
              onClick={handleSpeak}
              disabled={!isReady || !text}
            >
              Speak
            </Button>
          </div>

          {!isReady && (
            <p className="text-sm text-muted-foreground mt-2">
              Waiting for avatar to connect...
            </p>
          )}
        </Card>

        <div className="text-center">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Historical Chat
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AvatarTest;
