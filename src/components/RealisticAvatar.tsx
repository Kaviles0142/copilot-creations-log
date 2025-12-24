import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';

interface AnimationFrame {
  frameNumber: number;
  imageUrl: string;
  speechSegment: string;
}

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  videoUrl?: string | null;
  animationFrames?: AnimationFrame[];
  isGeneratingVideo?: boolean;
  isSpeaking?: boolean;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onAudioEnd?: () => void;
  onAnimationEnd?: () => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl,
  videoUrl,
  animationFrames,
  isGeneratingVideo,
  isSpeaking: externalIsSpeaking,
  figureName,
  figureId,
  onVideoEnd,
  onAudioEnd,
  onAnimationEnd,
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioUrlRef = useRef<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const isSpeaking = externalIsSpeaking || isPlayingAudio || isPlayingVideo || isPlayingAnimation;

  // Stop animation playback
  const stopAnimation = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setIsPlayingAnimation(false);
  };

  // Play audio when audioUrl changes (and no animation frames)
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;
    
    // Don't replay same audio
    if (lastAudioUrlRef.current === audioUrl) return;
    lastAudioUrlRef.current = audioUrl;

    // If we have animation frames, let the animation effect handle audio
    if (animationFrames && animationFrames.length > 0) return;

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
  }, [audioUrl, animationFrames, onAudioEnd]);

  // Play K2 animation frames synced with audio
  useEffect(() => {
    if (!animationFrames || animationFrames.length === 0 || !audioUrl) {
      return;
    }

    console.log(`🎬 Playing ${animationFrames.length} K2 animation frames`);
    stopAnimation();
    setCurrentFrameIndex(0);
    setIsPlayingAnimation(true);

    // Play audio
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(err => {
        console.error('Audio playback failed:', err);
      });
    }

    // Estimate duration, will be updated when audio metadata loads
    const estimatedDuration = 5000;
    const msPerFrame = estimatedDuration / animationFrames.length;

    let frameIndex = 0;
    animationIntervalRef.current = setInterval(() => {
      frameIndex++;
      if (frameIndex >= animationFrames.length) {
        stopAnimation();
        setCurrentFrameIndex(0);
        onAnimationEnd?.();
        return;
      }
      setCurrentFrameIndex(frameIndex);
    }, msPerFrame);

    return () => stopAnimation();
  }, [animationFrames, audioUrl, onAnimationEnd]);

  // Sync animation timing with actual audio duration
  useEffect(() => {
    if (!audioRef.current || !animationFrames || animationFrames.length === 0) return;

    const audio = audioRef.current;
    
    const handleLoadedMetadata = () => {
      if (animationIntervalRef.current && audio.duration) {
        stopAnimation();
        setCurrentFrameIndex(0);
        setIsPlayingAnimation(true);
        
        const durationMs = audio.duration * 1000;
        const msPerFrame = durationMs / animationFrames.length;
        console.log(`🎬 Synced: ${durationMs}ms, ${msPerFrame}ms/frame`);

        let frameIndex = 0;
        animationIntervalRef.current = setInterval(() => {
          frameIndex++;
          if (frameIndex >= animationFrames.length) {
            stopAnimation();
            setCurrentFrameIndex(0);
            return;
          }
          setCurrentFrameIndex(frameIndex);
        }, msPerFrame);
      }
    };

    const handleEnded = () => {
      stopAnimation();
      setCurrentFrameIndex(0);
      onAnimationEnd?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [animationFrames, onAnimationEnd]);

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
    stopAnimation();
    setCurrentFrameIndex(0);
    setIsPlayingAudio(false);
  }, [figureId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimation();
  }, []);

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

  // Show generating overlay while K2 generates (but audio still plays with animation)
  if (isGeneratingVideo && !videoUrl && !animationFrames) {
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
          <span className="text-xs text-white/70">Animating...</span>
        </div>
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  // Show K2 animation frames if available
  if (animationFrames && animationFrames.length > 0) {
    const currentFrame = animationFrames[currentFrameIndex];
    const displayUrl = currentFrame?.imageUrl || imageUrl;
    
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <img
          src={displayUrl}
          alt={figureName || 'Animated Avatar'}
          className="w-full h-full object-cover transition-opacity duration-75"
        />
        {isPlayingAnimation && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
          <span className="text-xs text-white/70">
            {currentFrameIndex + 1}/{animationFrames.length}
          </span>
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
