import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  videoUrl?: string | null;
  isGeneratingVideo?: boolean;
  isSpeaking?: boolean;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onAudioEnd?: () => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl,
  videoUrl,
  isGeneratingVideo,
  isSpeaking: externalIsSpeaking,
  figureName,
  figureId,
  onVideoEnd,
  onAudioEnd,
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAudioUrlRef = useRef<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isSpeaking = externalIsSpeaking || isPlayingAudio || isPlayingVideo;

  // Play audio when audioUrl changes
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;
    
    // Don't replay same audio
    if (lastAudioUrlRef.current === audioUrl) return;
    lastAudioUrlRef.current = audioUrl;

    console.log('🎤 Playing audio with static avatar');
    audioRef.current.src = audioUrl;
    audioRef.current.load();
    
    const handlePlay = () => setIsPlayingAudio(true);
    const handleEnded = () => {
      setIsPlayingAudio(false);
      onAudioEnd?.();
    };
    const handleError = () => {
      setIsPlayingAudio(false);
      console.error('Audio playback error');
    };

    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);

    audioRef.current.play().catch(err => {
      console.error('Audio autoplay failed:', err);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
      }
    };
  }, [audioUrl, onAudioEnd]);

  // Play video when URL is available
  useEffect(() => {
    if (videoRef.current && videoUrl && !videoError) {
      console.log('🎬 Loading video:', videoUrl.substring(0, 60) + '...');
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.error('❌ Video autoplay failed:', err);
        setVideoError(true);
      });
    }
  }, [videoUrl, videoError]);

  // Reset state when figure changes
  useEffect(() => {
    setVideoError(false);
    lastAudioUrlRef.current = null;
    setIsPlayingAudio(false);
  }, [figureId]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading portrait...</p>
        </div>
      </Card>
    );
  }

  if (!imageUrl) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No avatar selected</p>
      </Card>
    );
  }

  // Show generating overlay while video generates
  if (isGeneratingVideo && !videoUrl) {
    return (
      <Card className={`w-full max-w-md mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
        <img 
          src={imageUrl} 
          alt={figureName || 'Avatar'} 
          className={`w-full h-full object-cover ${isSpeaking ? 'animate-speaking-pulse' : ''}`}
        />
        {isSpeaking && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
          <Loader2 className="w-3 h-3 animate-spin text-white" />
          <span className="text-xs text-white/70">Generating video...</span>
        </div>
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  // Show video if available and no error
  if (videoUrl && !videoError) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          muted={false}
          controls={false}
          className="w-full h-full object-cover"
          onPlay={() => {
            console.log('▶️ Video playing');
            setIsPlayingVideo(true);
          }}
          onEnded={() => {
            console.log('⏹️ Video ended');
            setIsPlayingVideo(false);
            onVideoEnd?.();
          }}
          onError={(e) => {
            console.error('❌ Video playback error:', e);
            setVideoError(true);
          }}
        />
        {isPlayingVideo && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
      </Card>
    );
  }

  // Static image with audio playback - apply speaking animation
  return (
    <Card className={`w-full max-w-md mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
      <img 
        src={imageUrl} 
        alt={figureName || 'Avatar'} 
        className={`w-full h-full object-cover transition-all duration-300 ${isSpeaking ? 'animate-speaking-pulse' : ''}`}
      />
      {isSpeaking && (
        <>
          {/* Animated sound waves overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1 bg-primary/60 rounded-full"
                  style={{
                    height: `${8 + Math.sin((Date.now() / 150) + i) * 8}px`,
                    animation: `speaking-pulse ${0.3 + i * 0.1}s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        </>
      )}
      <audio ref={audioRef} hidden />
    </Card>
  );
};

export default RealisticAvatar;
