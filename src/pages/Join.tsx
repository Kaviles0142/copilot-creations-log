import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Loader2, Mic, MicOff, Video, VideoOff, ArrowLeft } from 'lucide-react';

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

      await new Promise(resolve => setTimeout(resolve, 1500));

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
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xl max-w-md w-full mx-4 glow-sm">
          <div className="w-3 h-3 rounded-full bg-primary mb-8 mx-auto animate-pulse" />
          <h1 className="font-display text-xl text-muted-foreground mb-1">Never Gone</h1>
          <h2 className="font-display text-3xl font-bold text-foreground mb-8">Connecting...</h2>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Preparing your session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="bg-card border border-border rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden">
          {/* Header Bar */}
          <div className="bg-muted/30 px-6 py-3 flex items-center gap-3 border-b border-border">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm text-muted-foreground flex-1 text-center font-medium">
              Never Gone : Pre-Call Setup
            </span>
          </div>

          {/* Video Preview */}
          <div className="p-6">
            <div className="relative bg-background rounded-xl aspect-video flex items-center justify-center mb-6 border border-border overflow-hidden">
              <VideoOff className="w-12 h-12 text-muted-foreground/30" />
              
              {/* Toggle Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  variant={audioEnabled ? "default" : "secondary"}
                  size="lg"
                  className={`rounded-lg px-5 ${!audioEnabled ? 'bg-secondary hover:bg-secondary/80' : 'bg-primary'}`}
                  onClick={() => setAudioEnabled(!audioEnabled)}
                >
                  {audioEnabled ? <Mic className="w-5 h-5 mr-2" /> : <MicOff className="w-5 h-5 mr-2" />}
                  Audio
                </Button>
                <Button
                  variant={videoEnabled ? "default" : "secondary"}
                  size="lg"
                  className={`rounded-lg px-5 ${!videoEnabled ? 'bg-secondary hover:bg-secondary/80' : 'bg-primary'}`}
                  onClick={() => setVideoEnabled(!videoEnabled)}
                >
                  {videoEnabled ? <Video className="w-5 h-5 mr-2" /> : <VideoOff className="w-5 h-5 mr-2" />}
                  Video
                </Button>
              </div>
            </div>

            {/* Device Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <Select defaultValue="default">
                  <SelectTrigger className="flex-1 bg-background border-border">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Microphone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <Select defaultValue="default">
                  <SelectTrigger className="flex-1 bg-background border-border">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Camera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-destructive text-sm text-center mb-4">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStart}
                className="bg-hero-gradient hover:opacity-90 px-8"
              >
                Start
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Join;