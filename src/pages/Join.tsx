import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react';

const Join = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const guestId = !user ? `guest_${crypto.randomUUID()}` : null;
      
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert({
          user_id: user?.id || null,
          guest_id: guestId,
        })
        .select('room_code')
        .single();

      if (insertError) throw insertError;

      // Simulate connection delay for UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      navigate(`/rooms/${data.room_code}`, { replace: true });
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
      setIsConnecting(false);
    }
  };

  // Connecting overlay
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xl max-w-md w-full mx-4">
          <div className="w-3 h-3 rounded-full bg-destructive mb-8 mx-auto" />
          <h1 className="font-display text-2xl text-muted-foreground mb-1">Never Gone</h1>
          <h2 className="font-display text-3xl font-bold text-foreground mb-8">Session</h2>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 px-6 py-3 flex items-center gap-3 border-b border-border">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-muted-foreground flex-1 text-center">
            Never Gone : Start a Conversation
          </span>
        </div>

        {/* Video Preview Area */}
        <div className="p-6">
          <div className="relative bg-black rounded-xl aspect-video flex items-center justify-center mb-6">
            {/* Video off icon */}
            <VideoOff className="w-16 h-16 text-muted-foreground/50" />
            
            {/* Audio/Video toggle buttons */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                className={`rounded-lg px-6 ${!audioEnabled ? 'bg-secondary' : 'bg-secondary/80'}`}
                onClick={() => setAudioEnabled(!audioEnabled)}
              >
                {audioEnabled ? (
                  <Mic className="w-5 h-5 mr-2" />
                ) : (
                  <MicOff className="w-5 h-5 mr-2 text-destructive" />
                )}
                Audio
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className={`rounded-lg px-6 ${!videoEnabled ? 'bg-secondary' : 'bg-secondary/80'}`}
                onClick={() => setVideoEnabled(!videoEnabled)}
              >
                {videoEnabled ? (
                  <Video className="w-5 h-5 mr-2" />
                ) : (
                  <VideoOff className="w-5 h-5 mr-2 text-destructive" />
                )}
                Video
              </Button>
            </div>
          </div>

          {/* Device Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <Select defaultValue="default">
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Microphone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-muted-foreground" />
              <Select defaultValue="default">
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Camera</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-destructive text-sm text-center mb-4">{error}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStart}
              className="bg-primary hover:bg-primary/90 px-8"
            >
              Start
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Join;
