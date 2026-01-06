import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    if (participants.length === 0) {
      setError('Please add at least one historical figure');
      return;
    }
    
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

      // Pass figures as state to the room
      navigate(`/rooms/${data.room_code}`, { 
        replace: true,
        state: { figures: participants }
      });
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
      setIsConnecting(false);
    }
  };

  // Connecting overlay
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
          {/* Header Bar with dots */}
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
          
          <div className="p-12 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground mb-8">Connecting...</h2>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Preparing your session</p>
          </div>
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

          {/* Historical Figures Input */}
          <div className="mb-5">
            <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              Add Historical Figures
            </label>
            <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 p-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {participants.map((p) => (
                <Badge 
                  key={p} 
                  variant="secondary" 
                  className="pr-1 gap-1 text-xs h-7"
                >
                  {p}
                  <button 
                    onClick={() => removeParticipant(p)}
                    className="ml-0.5 hover:text-destructive rounded-full p-0.5 hover:bg-destructive/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                placeholder={participants.length === 0 ? "Type a name..." : "Add another..."}
                className="flex-1 min-w-[100px] border-0 h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addParticipant();
                  }
                }}
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={addParticipant}
                className="h-7 px-2.5 text-xs"
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              e.g. Albert Einstein, Cleopatra, Leonardo da Vinci
            </p>
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