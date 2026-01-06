import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mic, MicOff, Video, VideoOff, X, UserPlus } from 'lucide-react';

const Join = () => {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  
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
          setError('Could not access camera. Please check permissions.');
        }
      } else {
        // Stop video tracks
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
  }, [videoEnabled]);

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
          setError('Could not access microphone. Please check permissions.');
        }
      } else if (!audioEnabled && streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.stop());
        if (!videoEnabled) {
          streamRef.current = null;
        }
      }
    };
    handleAudio();
  }, [audioEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const addParticipant = () => {
    const trimmed = participantInput.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants([...participants, trimmed]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (name: string) => {
    setParticipants(participants.filter(p => p !== name));
  };

  const handleStart = async () => {
    setIsConnecting(true);
    setError(null);

    // Stop streams before navigating
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const guestId = `guest_${crypto.randomUUID()}`;
      
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert({
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
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xl max-w-sm w-full mx-4 glow-sm">
          <div className="w-3 h-3 rounded-full bg-primary mb-8 mx-auto animate-pulse" />
          <h1 className="font-display text-xl text-muted-foreground mb-1">Never Gone</h1>
          <h2 className="font-display text-2xl font-bold text-foreground mb-8">Connecting...</h2>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Preparing your session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header Bar */}
        <div className="bg-muted/30 px-5 py-2.5 flex items-center gap-3 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-muted-foreground flex-1 text-center font-medium">
            Never Gone
          </span>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Video Preview */}
          <div className="relative bg-background rounded-xl aspect-video flex items-center justify-center mb-5 border border-border overflow-hidden">
            {videoEnabled ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            ) : (
              <VideoOff className="w-10 h-10 text-muted-foreground/30" />
            )}
            
            {/* Toggle Controls */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant={audioEnabled ? "default" : "secondary"}
                size="sm"
                className={`rounded-lg px-4 ${audioEnabled ? 'bg-primary' : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setAudioEnabled(!audioEnabled)}
              >
                {audioEnabled ? <Mic className="w-4 h-4 mr-1.5" /> : <MicOff className="w-4 h-4 mr-1.5" />}
                Audio
              </Button>
              <Button
                variant={videoEnabled ? "default" : "secondary"}
                size="sm"
                className={`rounded-lg px-4 ${videoEnabled ? 'bg-primary' : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setVideoEnabled(!videoEnabled)}
              >
                {videoEnabled ? <Video className="w-4 h-4 mr-1.5" /> : <VideoOff className="w-4 h-4 mr-1.5" />}
                Video
              </Button>
            </div>
          </div>

          {/* Device Selectors */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select defaultValue="default">
                <SelectTrigger className="flex-1 bg-background border-border h-9 text-sm">
                  <SelectValue placeholder="Microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Microphone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select defaultValue="default">
                <SelectTrigger className="flex-1 bg-background border-border h-9 text-sm">
                  <SelectValue placeholder="Camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Camera</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Add Participants */}
          <div className="mb-5">
            <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              Add Participants
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                placeholder="Enter name or email..."
                className="flex-1 bg-background border-border h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={addParticipant}
                className="px-3"
              >
                Add
              </Button>
            </div>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p) => (
                  <Badge 
                    key={p} 
                    variant="secondary" 
                    className="pr-1.5 gap-1 text-xs"
                  >
                    {p}
                    <button 
                      onClick={() => removeParticipant(p)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-destructive text-sm text-center mb-4">{error}</p>
          )}

          {/* Start Button */}
          <Button 
            onClick={handleStart}
            className="w-full bg-hero-gradient hover:opacity-90 h-11"
          >
            Start Call
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Join;