import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
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
  User
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

  // Mock figure name for now - will be dynamic later
  const figureName = room.figure_name || 'AI Assistant';
  const guestName = user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 px-4 py-2 flex items-center gap-4 border-b border-zinc-800">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-white text-sm font-medium">{figureName}</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Video Grid */}
        <div className="flex-shrink-0 p-6 flex justify-center gap-4">
          {/* Figure Video Tile */}
          <div className="relative w-64 h-44 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                <User className="w-8 h-8 text-zinc-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <span className="text-white text-sm font-medium">{figureName}</span>
            </div>
          </div>

          {/* Guest Video Tile */}
          <div className="relative w-64 h-44 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                <User className="w-8 h-8 text-zinc-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <span className="text-white text-sm font-medium">{guestName}</span>
            </div>
          </div>
        </div>

        {/* Content/Presentation Area */}
        <div className="flex-1 mx-6 mb-6 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden">
          <div className="text-center p-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 tracking-tight">
              Conversation with
            </h1>
            <h2 className="text-5xl md:text-6xl font-display font-bold text-gradient">
              {figureName}
            </h2>
            <p className="text-zinc-500 mt-6 text-lg">
              Room: {room.room_code}
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Toolbar */}
      <footer className="bg-zinc-900 border-t border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-center gap-2">
          {/* Audio Toggle */}
          <ToolbarButton 
            icon={audioEnabled ? Mic : MicOff}
            label="Audio"
            active={audioEnabled}
            onClick={() => setAudioEnabled(!audioEnabled)}
            muted={!audioEnabled}
          />

          {/* Video Toggle */}
          <ToolbarButton 
            icon={videoEnabled ? Video : VideoOff}
            label="Video"
            active={videoEnabled}
            onClick={() => setVideoEnabled(!videoEnabled)}
            muted={!videoEnabled}
          />

          {/* Participants */}
          <ToolbarButton 
            icon={Users}
            label="Participants"
            onClick={() => {}}
          />

          {/* Chat */}
          <ToolbarButton 
            icon={MessageSquare}
            label="Chat"
            onClick={() => {}}
          />

          {/* React */}
          <ToolbarButton 
            icon={Heart}
            label="React"
            onClick={() => {}}
          />

          {/* Share */}
          <ToolbarButton 
            icon={Share2}
            label="Share"
            onClick={() => {}}
          />

          {/* More */}
          <ToolbarButton 
            icon={MoreHorizontal}
            label="More"
            onClick={() => {}}
          />

          {/* Spacer */}
          <div className="w-8" />

          {/* End Button */}
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
    className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
  >
    <div className="relative">
      <Icon className={`w-5 h-5 ${muted ? 'text-red-400' : 'text-zinc-400 group-hover:text-white'}`} />
      {active !== undefined && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </div>
    <span className="text-xs text-zinc-500 group-hover:text-zinc-300">{label}</span>
  </button>
);

export default Room;
