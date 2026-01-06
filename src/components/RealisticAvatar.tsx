import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  videoUrl?: string | null;
  isGeneratingVideo?: boolean;
  isSpeaking?: boolean;
  figureName?: string;
  figureId?: string;
  videoChunkProgress?: { current: number; total: number } | null; // Kept for compatibility but not used
  allVideoUrls?: string[]; // Kept for compatibility
  isLoadingNextChunk?: boolean; // Kept for compatibility
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
  const lastVideoUrlRef = useRef<string | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [lastSuccessfulVideoUrl, setLastSuccessfulVideoUrl] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  const isSpeaking = externalIsSpeaking || isPlayingAudio || isPlayingVideo;

  // Timer for video generation
  useEffect(() => {
    if (isGeneratingVideo && !videoUrl) {
      setLoadingSeconds(0);
      loadingTimerRef.current = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
    
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [isGeneratingVideo, videoUrl]);

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
    if (videoUrl && videoUrl !== lastVideoUrlRef.current) {
      lastVideoUrlRef.current = videoUrl;
      setActiveVideoUrl(videoUrl);
      setLastSuccessfulVideoUrl(videoUrl);
      setVideoError(false);
      console.log('🎬 New video URL received:', videoUrl.substring(0, 60) + '...');
    }
  }, [videoUrl]);

  // Handle video playback when activeVideoUrl changes
  useEffect(() => {
    if (videoRef.current && activeVideoUrl && !videoError) {
      console.log('🎬 Loading video:', activeVideoUrl.substring(0, 60) + '...');
      videoRef.current.src = activeVideoUrl;
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.error('❌ Video autoplay failed:', err);
        setVideoError(true);
      });
    }
  }, [activeVideoUrl, videoError]);

  // Reset state when figure changes
  useEffect(() => {
    console.log('🔄 Figure changed, resetting avatar state');
    setVideoError(false);
    lastAudioUrlRef.current = null;
    lastVideoUrlRef.current = null;
    setIsPlayingAudio(false);
    setIsPlayingVideo(false);
    setLoadingSeconds(0);
    setActiveVideoUrl(null);
    setLastSuccessfulVideoUrl(null);
  }, [figureId]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlayingVideo) {
      videoRef.current.pause();
      setIsPlayingVideo(false);
    } else {
      videoRef.current.play().catch(console.error);
      setIsPlayingVideo(true);
    }
  };

  // Replay last successful video
  const handleReplay = () => {
    if (!lastSuccessfulVideoUrl) return;
    setVideoError(false);
    setActiveVideoUrl(lastSuccessfulVideoUrl);
    console.log('🔄 Replaying video:', lastSuccessfulVideoUrl.substring(0, 60) + '...');
  };

  // Handle video ended
  const handleVideoEnded = () => {
    console.log('⏹️ Video ended');
    setIsPlayingVideo(false);
    setActiveVideoUrl(null);
    onVideoEnd?.();
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-lg mx-auto aspect-square flex items-center justify-center bg-muted">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading portrait...</p>
        </div>
      </Card>
    );
  }

  if (!imageUrl) {
    return (
      <Card className="w-full max-w-lg mx-auto aspect-square flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No avatar selected</p>
      </Card>
    );
  }

  // Show generating overlay while video generates with timer
  if (isGeneratingVideo && !activeVideoUrl) {
    return (
      <Card className={`w-full max-w-lg mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
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
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 px-3 py-2 rounded">
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <div className="text-right">
            <span className="text-xs text-white/70 block">Generating video...</span>
            <span className="text-sm text-white font-bold">{loadingSeconds}s</span>
          </div>
        </div>
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  // Show video if available and no error with controls
  if (activeVideoUrl && !videoError) {
    return (
      <Card className="w-full max-w-lg mx-auto aspect-square overflow-hidden relative">
        {/* Background image behind video */}
        <img 
          src={imageUrl} 
          alt={figureName || 'Avatar'} 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          controls={false}
          className="absolute inset-0 w-full h-full object-cover"
          onPlay={() => {
            console.log('▶️ Video playing');
            setIsPlayingVideo(true);
          }}
          onEnded={handleVideoEnded}
          onError={(e) => {
            console.error('❌ Video playback error:', e);
            setVideoError(true);
            setActiveVideoUrl(null);
          }}
        />
        {/* Video controls in corner */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(console.error);
              }
            }}
            title="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handlePlayPause}
            title={isPlayingVideo ? "Pause" : "Play"}
          >
            {isPlayingVideo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {isPlayingVideo && (
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded ml-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-white">Speaking</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Static image with audio playback - apply speaking animation
  return (
    <Card className={`w-full max-w-lg mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
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
      {/* Replay button when there's a previous video */}
      {lastSuccessfulVideoUrl && !isSpeaking && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handleReplay}
            title="Replay video"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}
      <audio ref={audioRef} hidden />
      {/* Hidden video element for replay functionality */}
      <video ref={videoRef} hidden />
    </Card>
  );
};

export default RealisticAvatar;
