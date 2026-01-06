import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Send,
  Radio
} from 'lucide-react';
import { getFigureContext } from '@/utils/figureContextMapper';

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

interface LocationState {
  figures?: string[];
}

interface FigureAvatar {
  figureName: string;
  imageUrl: string | null;
  isLoading: boolean;
}

const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [figures, setFigures] = useState<string[]>(state?.figures || []);
  const [podcastMode, setPodcastMode] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [figureAvatars, setFigureAvatars] = useState<Map<string, FigureAvatar>>(new Map());
  const [podcastSceneImage, setPodcastSceneImage] = useState<string | null>(null);
  const [isGeneratingPodcastScene, setIsGeneratingPodcastScene] = useState(false);
  const podcastSceneGeneratedFor = useRef<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle video toggle
  useEffect(() => {
    const handleVideo = async () => {
      if (videoEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true,
            audio: audioEnabled 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Error accessing camera:', err);
          setVideoEnabled(false);
        }
      } else {
        if (streamRef.current) {
          streamRef.current.getVideoTracks().forEach(track => track.stop());
          if (!audioEnabled) {
            streamRef.current = null;
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
          }
        }
      }
    };
    handleVideo();
  }, [videoEnabled, audioEnabled]);

  // Handle audio toggle
  useEffect(() => {
    const handleAudio = async () => {
      if (audioEnabled && !streamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: videoEnabled 
          });
          streamRef.current = stream;
          if (videoRef.current && videoEnabled) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Error accessing microphone:', err);
          setAudioEnabled(false);
        }
      } else if (!audioEnabled && streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.stop());
        if (!videoEnabled) {
          streamRef.current = null;
        }
      }
    };
    handleAudio();
  }, [audioEnabled, videoEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Generate avatar portraits for each figure - all at once in parallel
  useEffect(() => {
    const generateAvatarsForFigures = async () => {
      // Filter to only new figures that we haven't started loading
      const newFigures = figures.filter(f => !figureAvatars.has(f));
      if (newFigures.length === 0) return;

      // Set all to loading state at once
      setFigureAvatars(prev => {
        const updated = new Map(prev);
        newFigures.forEach(figureName => {
          updated.set(figureName, { figureName, imageUrl: null, isLoading: true });
        });
        return updated;
      });

      // Generate all portraits in parallel
      const promises = newFigures.map(async (figureName) => {
        try {
          const figureId = figureName.toLowerCase().replace(/\s+/g, '-');
          const context = getFigureContext(figureName);
          
          console.log(`🎨 Generating portrait for ${figureName}...`);
          
          const { data, error } = await supabase.functions.invoke('generate-avatar-portrait', {
            body: { figureName, figureId, context }
          });

          if (error) throw error;

          console.log(`✅ Portrait ready for ${figureName}:`, data.cached ? '(cached)' : '(new)');
          return { figureName, imageUrl: data.imageUrl, isLoading: false };
        } catch (err) {
          console.error(`❌ Failed to generate portrait for ${figureName}:`, err);
          return { figureName, imageUrl: null, isLoading: false };
        }
      });

      const results = await Promise.all(promises);
      
      // Update all at once
      setFigureAvatars(prev => {
        const updated = new Map(prev);
        results.forEach(result => {
          updated.set(result.figureName, result);
        });
        return updated;
      });
    };

    if (figures.length > 0) {
      generateAvatarsForFigures();
    }
  }, [figures]);

  // Generate podcast scene image when podcast mode is enabled
  useEffect(() => {
    const generatePodcastScene = async () => {
      if (!podcastMode || figures.length === 0) return;
      
      // Create a unique key for this combination of figures
      const figuresKey = [...figures].sort().join('|');
      if (podcastSceneGeneratedFor.current === figuresKey) return;
      
      podcastSceneGeneratedFor.current = figuresKey;
      setIsGeneratingPodcastScene(true);
      setPodcastSceneImage(null);

      try {
        console.log('🎙️ Generating podcast scene for:', figures);

        const { data, error } = await supabase.functions.invoke('generate-podcast-scene', {
          body: { figures }
        });

        if (error) throw error;

        console.log('✅ Podcast scene ready:', data.cached ? '(cached)' : '(new)');
        setPodcastSceneImage(data.imageUrl);
      } catch (err) {
        console.error('❌ Failed to generate podcast scene:', err);
      } finally {
        setIsGeneratingPodcastScene(false);
      }
    };

    generatePodcastScene();
  }, [podcastMode, figures]);

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    navigate('/join');
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
          <Button onClick={() => navigate('/join')} className="bg-hero-gradient hover:opacity-90">
            Back to Join
          </Button>
        </div>
      </div>
    );
  }

  const displayFigures = figures.length > 0 ? figures : (room.figure_name ? [room.figure_name] : ['AI Assistant']);
  const guestName = 'You';
  const totalParticipants = displayFigures.length + 1; // +1 for "You"

  // Dynamic tile sizing based on participant count (only for non-podcast mode)
  const getTileClasses = () => {
    if (podcastMode) return 'w-36 h-24';
    
    if (totalParticipants <= 2) {
      return 'w-64 h-48 md:w-80 md:h-60';
    } else if (totalParticipants <= 4) {
      return 'w-40 h-28 md:w-56 md:h-40';
    } else if (totalParticipants <= 6) {
      return 'w-32 h-24 md:w-44 md:h-32';
    } else {
      return 'w-28 h-20 md:w-36 md:h-28';
    }
  };

  const getAvatarClasses = () => {
    if (podcastMode) return 'w-10 h-10';
    
    if (totalParticipants <= 2) {
      return 'w-20 h-20';
    } else if (totalParticipants <= 4) {
      return 'w-14 h-14';
    } else {
      return 'w-10 h-10';
    }
  };

  const getIconClasses = () => {
    if (podcastMode) return 'w-5 h-5';
    
    if (totalParticipants <= 2) {
      return 'w-10 h-10';
    } else if (totalParticipants <= 4) {
      return 'w-7 h-7';
    } else {
      return 'w-5 h-5';
    }
  };

  const getMuteIconClasses = () => {
    if (podcastMode) return 'w-5 h-5';
    if (totalParticipants <= 2) return 'w-7 h-7';
    return 'w-5 h-5';
  };

  const getMuteInnerIconClasses = () => {
    if (podcastMode) return 'w-3 h-3';
    if (totalParticipants <= 2) return 'w-4 h-4';
    return 'w-3 h-3';
  };

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
          <span className="text-foreground text-sm font-medium">
            {displayFigures.length === 1 ? displayFigures[0] : `${displayFigures.length} participants`}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{room.room_code}</span>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <main className={`flex-1 flex flex-col overflow-hidden p-4 ${!podcastMode ? 'justify-center' : ''}`}>
          {/* Video Tiles */}
          <div className={`flex justify-center gap-4 flex-wrap ${podcastMode ? 'flex-shrink-0 mb-4' : 'items-center'}`}>
            {/* Guest (You) Tile */}
            <div className={`relative bg-card rounded-xl overflow-hidden border border-border transition-all duration-300 ${getTileClasses()}`}>
              {videoEnabled ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`rounded-full bg-primary/20 flex items-center justify-center transition-all ${getAvatarClasses()}`}>
                    <User className={`text-primary transition-all ${getIconClasses()}`} />
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                <span className={`text-foreground font-medium ${podcastMode || totalParticipants > 2 ? 'text-xs' : 'text-sm'}`}>{guestName}</span>
              </div>
              {!audioEnabled && (
                <div className={`absolute top-2 right-2 rounded-full bg-destructive flex items-center justify-center ${getMuteIconClasses()}`}>
                  <MicOff className={`text-destructive-foreground ${getMuteInnerIconClasses()}`} />
                </div>
              )}
            </div>

            {/* Figure Tiles */}
            {displayFigures.map((figure, index) => {
              const avatar = figureAvatars.get(figure);
              const showImage = !podcastMode && avatar?.imageUrl;
                return (
                <div key={index} className={`relative rounded-xl overflow-hidden border border-border transition-all duration-300 ${getTileClasses()} ${showImage ? 'bg-black' : 'bg-card'}`}>
                  {avatar?.isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className={`animate-spin text-muted-foreground ${getIconClasses()}`} />
                    </div>
                  ) : showImage ? (
                    <img 
                      src={avatar.imageUrl} 
                      alt={figure}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`rounded-full bg-muted flex items-center justify-center transition-all ${getAvatarClasses()}`}>
                        <User className={`text-muted-foreground transition-all ${getIconClasses()}`} />
                      </div>
                    </div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 p-2 ${showImage ? 'bg-gradient-to-t from-black/90 to-transparent' : 'bg-gradient-to-t from-background/90 to-transparent'}`}>
                    <span className={`font-medium truncate block ${podcastMode || totalParticipants > 2 ? 'text-xs' : 'text-sm'} ${showImage ? 'text-white' : 'text-foreground'}`}>{figure}</span>
                  </div>
                  {/* Camera off badge in podcast mode */}
                  {podcastMode && (
                    <div className={`absolute top-2 right-2 rounded-full bg-destructive flex items-center justify-center ${getMuteIconClasses()}`}>
                      <VideoOff className={`text-destructive-foreground ${getMuteInnerIconClasses()}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Content Area - Only shown in podcast mode */}
          {podcastMode && (
            <div className="flex-1 bg-black rounded-xl border border-border overflow-hidden min-h-0 relative">
              {isGeneratingPodcastScene ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground text-sm">Generating podcast scene...</p>
                </div>
              ) : podcastSceneImage ? (
                <img 
                  src={podcastSceneImage} 
                  alt={`Podcast scene with ${displayFigures.join(', ')}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-card">
                  <div className="text-center p-8">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-2 leading-tight">
                      Conversation with
                    </h1>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-gradient leading-tight">
                      {displayFigures.length === 1 ? displayFigures[0] : `${displayFigures.length} Figures`}
                    </h2>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {displayFigures.map((figure, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {figure}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Chat Sidebar - Desktop: side panel, Mobile: bottom sheet */}
        {chatOpen && (
          <aside className="fixed inset-x-0 bottom-0 h-[60vh] md:static md:h-auto md:w-80 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col z-50 animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
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
          
          <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors group ${
                  moreMenuOpen ? 'bg-muted' : 'hover:bg-muted'
                }`}
              >
                <MoreHorizontal className={`w-5 h-5 ${moreMenuOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className={`text-xs ${moreMenuOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-48 p-1 bg-card border-border">
              <button
                onClick={() => {
                  setPodcastMode(!podcastMode);
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-foreground"
              >
                <Radio className="w-4 h-4" />
                {podcastMode ? 'Disable' : 'Enable'} Podcast Mode
              </button>
            </PopoverContent>
          </Popover>
          
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