import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Users, 
  MessageSquare, 
  Heart, 
  Share2, 
  MoreHorizontal,
  User,
  X,
  Plus,
  Send
} from 'lucide-react';

interface Room {
  id: string;
  room_code: string;
  user_id: string | null;
  guest_id: string | null;
  figure_id: string | null;
  figure_name: string | null;
  status: string;
  created_at: string;
}

const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomCode) {
        setError('Invalid room code');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Room not found');
          } else {
            throw fetchError;
          }
        } else {
          setRoom(data);
        }
      } catch (err) {
        console.error('Error fetching room:', err);
        setError('Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode]);

  const handleEndCall = () => {
    navigate('/dashboard');
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      setMessage('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center bg-card border border-border rounded-2xl p-8 max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {error || 'Room not found'}
          </h2>
          <p className="text-muted-foreground mb-6">
            This room may have expired or doesn't exist.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="bg-hero-gradient hover:opacity-90">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const figureName = room.figure_name || 'AI Assistant';
  const guestName = user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-card px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-foreground text-sm font-medium">{figureName}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{room.room_code}</span>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <main className="flex-1 flex flex-col overflow-hidden p-4">
          {/* Video Tiles */}
          <div className="flex-shrink-0 flex justify-center gap-3 mb-4">
            {/* Figure Tile */}
            <div className="relative w-36 h-24 bg-card rounded-lg overflow-hidden border border-border">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                <span className="text-foreground text-xs font-medium">{figureName}</span>
              </div>
            </div>

            {/* Guest Tile */}
            <div className="relative w-36 h-24 bg-card rounded-lg overflow-hidden border border-border">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                <span className="text-foreground text-xs font-medium">{guestName}</span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-card rounded-xl border border-border flex items-center justify-center overflow-hidden min-h-0">
            <div className="text-center p-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-2 leading-tight">
                Conversation with
              </h1>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-gradient leading-tight">
                {figureName}
              </h2>
              <p className="text-muted-foreground mt-6">
                Voice conversation coming soon...
              </p>
            </div>
          </div>
        </main>

        {/* Chat Sidebar */}
        {chatOpen && (
          <aside className="w-80 bg-card border-l border-border flex flex-col">
            <div className="flex-shrink-0 p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-foreground font-semibold">Session Chat</h3>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">Everyone</Badge>
                <button className="w-7 h-7 rounded bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="w-4 h-4 rounded-full border border-border" />
                <span>Who can see your messages?</span>
              </div>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message everyone"
                  className="flex-1 bg-background border-border"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button onClick={handleSendMessage} className="text-muted-foreground hover:text-foreground p-2">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Toolbar */}
      <footer className="flex-shrink-0 bg-card border-t border-border px-6 py-3">
        <div className="flex items-center justify-center gap-1">
          <ToolbarButton 
            icon={audioEnabled ? Mic : MicOff}
            label="Audio"
            active={audioEnabled}
            onClick={() => setAudioEnabled(!audioEnabled)}
            muted={!audioEnabled}
          />
          <ToolbarButton 
            icon={videoEnabled ? Video : VideoOff}
            label="Video"
            active={videoEnabled}
            onClick={() => setVideoEnabled(!videoEnabled)}
            muted={!videoEnabled}
          />
          <ToolbarButton icon={Users} label="Participants" onClick={() => {}} />
          <ToolbarButton 
            icon={MessageSquare} 
            label="Chat" 
            active={chatOpen}
            onClick={() => setChatOpen(!chatOpen)} 
          />
          <ToolbarButton icon={Heart} label="React" onClick={() => {}} />
          <ToolbarButton icon={Share2} label="Share" onClick={() => {}} />
          <ToolbarButton icon={MoreHorizontal} label="More" onClick={() => {}} />
          
          <div className="w-6" />
          
          <Button variant="destructive" className="px-6" onClick={handleEndCall}>
            End
          </Button>
        </div>
      </footer>
    </div>
  );
};

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
}

const ToolbarButton = ({ icon: Icon, label, active, muted, onClick }: ToolbarButtonProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors group ${
      active ? 'bg-muted' : 'hover:bg-muted'
    }`}
  >
    <Icon className={`w-5 h-5 ${muted ? 'text-destructive' : active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
    <span className={`text-xs ${active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>{label}</span>
  </button>
);

export default Room;