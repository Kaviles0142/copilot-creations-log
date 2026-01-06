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
      // TODO: Implement message sending
      setMessage('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            {error || 'Room not found'}
          </h2>
          <p className="text-gray-400 mb-6">
            This room may have expired or doesn't exist.
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="secondary">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const figureName = room.figure_name || 'AI Assistant';
  const guestName = user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-zinc-900 px-4 py-2 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-white text-sm font-medium">{figureName}</span>
        </div>
      </header>

      {/* Main Content with Optional Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Video Tiles - Compact */}
          <div className="flex-shrink-0 p-4 flex justify-center gap-3">
            {/* Figure Video Tile */}
            <div className="relative w-40 h-28 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className="text-white text-xs font-medium">{figureName}</span>
              </div>
            </div>

            {/* Guest Video Tile */}
            <div className="relative w-40 h-28 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className="text-white text-xs font-medium">{guestName}</span>
              </div>
            </div>
          </div>

          {/* Large Content/Presentation Area */}
          <div className="flex-1 mx-4 mb-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden min-h-0">
            <div className="text-center p-8 md:p-16">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-2 tracking-tight leading-tight">
                Conversation with
              </h1>
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-gradient leading-tight">
                {figureName}
              </h2>
              <p className="text-zinc-500 mt-8 text-lg">
                Room: {room.room_code}
              </p>
            </div>
          </div>
        </main>

        {/* Chat Sidebar */}
        {chatOpen && (
          <aside className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex-shrink-0 p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">{figureName} : Session</h3>
                <button onClick={() => setChatOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">Everyone</Badge>
                <button className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <div className="w-4 h-4 rounded-full border border-zinc-600" />
                <span>Who can see your messages?</span>
              </div>
            </div>

            {/* Message Input */}
            <div className="flex-shrink-0 p-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message everyone"
                  className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage}
                  className="text-zinc-400 hover:text-white p-2"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 text-zinc-500 text-sm">
                <span className="cursor-pointer hover:text-white">T</span>
                <span className="cursor-pointer hover:text-white">GIF</span>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Toolbar */}
      <footer className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-center gap-1 md:gap-2">
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

          <ToolbarButton 
            icon={Users}
            label="Participants"
            onClick={() => {}}
          />

          <ToolbarButton 
            icon={MessageSquare}
            label="Chat"
            active={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          />

          <ToolbarButton 
            icon={Heart}
            label="React"
            onClick={() => {}}
          />

          <ToolbarButton 
            icon={Share2}
            label="Share"
            onClick={() => {}}
          />

          <ToolbarButton 
            icon={MoreHorizontal}
            label="More"
            onClick={() => {}}
          />

          <div className="w-4 md:w-8" />

          <Button 
            variant="destructive"
            className="px-6 rounded-lg"
            onClick={handleEndCall}
          >
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
    className={`flex flex-col items-center gap-1 px-3 md:px-4 py-2 rounded-lg transition-colors group ${
      active ? 'bg-zinc-800' : 'hover:bg-zinc-800'
    }`}
  >
    <div className="relative">
      <Icon className={`w-5 h-5 ${muted ? 'text-red-400' : active ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`} />
      {active !== undefined && active && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </div>
    <span className={`text-xs ${active ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{label}</span>
  </button>
);

export default Room;
