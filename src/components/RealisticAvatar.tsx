import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
import { useTalkingVideo } from '@/hooks/useTalkingVideo';

interface AnimationFrame {
  frameNumber: number;
  imageUrl: string;
  speechSegment: string;
}

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  // Either pass audioUrl for internal video generation
  audioUrl?: string | null;
  // Or pass videoUrl directly (pre-generated)
  videoUrl?: string | null;
  // Or pass animation frames (K2 generated)
  animationFrames?: AnimationFrame[];
  isGeneratingVideo?: boolean;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onVideoReady?: (videoUrl: string) => void;
  onAnimationEnd?: () => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl,
  videoUrl: externalVideoUrl,
  animationFrames,
  isGeneratingVideo: externalIsGenerating,
  figureName,
  figureId,
  onVideoEnd,
  onVideoReady,
  onAnimationEnd,
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const processedAudioRef = useRef<string | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [internalVideoUrl, setInternalVideoUrl] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);

  // Use the video URL from either source
  const videoUrl = externalVideoUrl || internalVideoUrl;

  // Internal video generation hook (only used when audioUrl is passed without videoUrl)
  const { 
    generateVideo, 
    isGenerating: internalIsGenerating, 
    status,
    reset 
  } = useTalkingVideo({
    onVideoReady: (url) => {
      console.log('🎥 Internal video ready:', url.substring(0, 60) + '...');
      setInternalVideoUrl(url);
      onVideoReady?.(url);
    },
    onError: (error) => {
      console.error('❌ Video generation failed:', error);
      if (audioUrl) {
        onVideoReady?.(audioUrl);
      }
    }
  });

  const isGeneratingVideo = externalIsGenerating || internalIsGenerating;

  // Stop animation playback
  const stopAnimation = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setIsPlayingAnimation(false);
  };

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

    // Estimate total duration based on audio (rough estimate)
    // We'll update this when audio metadata loads
    const estimatedDuration = 5000; // Default 5 seconds
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
        // Restart with correct timing
        stopAnimation();
        setCurrentFrameIndex(0);
        setIsPlayingAnimation(true);
        
        const durationMs = audio.duration * 1000;
        const msPerFrame = durationMs / animationFrames.length;
        console.log(`🎬 Synced animation: ${durationMs}ms total, ${msPerFrame}ms per frame`);

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

  // Generate video internally when we have image + audio but no external video
  useEffect(() => {
    if (!imageUrl || !audioUrl || externalVideoUrl || animationFrames) {
      return;
    }

    // Prevent re-processing same audio
    if (processedAudioRef.current === audioUrl) {
      return;
    }

    processedAudioRef.current = audioUrl;
    console.log('🎬 Starting internal video generation');
    generateVideo(imageUrl, audioUrl, figureId, figureName);
  }, [imageUrl, audioUrl, externalVideoUrl, animationFrames, figureId, figureName, generateVideo]);

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

  // Reset state when figure or video URL changes
  useEffect(() => {
    setVideoError(false);
  }, [videoUrl, figureId]);

  // Reset when figure changes
  useEffect(() => {
    if (figureId) {
      setInternalVideoUrl(null);
      processedAudioRef.current = null;
      stopAnimation();
      setCurrentFrameIndex(0);
      reset();
    }
  }, [figureId, reset]);

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

  // Show generating overlay
  if (isGeneratingVideo && !videoUrl && !animationFrames) {
    const statusMessage = status === 'generating' 
      ? 'Starting animation...' 
      : 'Creating K2 animation...';
    
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <img 
          src={imageUrl} 
          alt={figureName || 'Avatar'} 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-white" />
            <p className="text-sm text-white font-medium">{statusMessage}</p>
            <p className="text-xs text-white/70">K2 + Nano Banana</p>
          </div>
        </div>
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
        {/* Frame indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
          <span className="text-xs text-white/70">
            {currentFrameIndex + 1}/{animationFrames.length}
          </span>
        </div>
        {/* Hidden audio element */}
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

  // Static image fallback
  return (
    <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden">
      <img 
        src={imageUrl} 
        alt={figureName || 'Avatar'} 
        className="w-full h-full object-cover"
      />
      {/* Hidden audio for fallback playback */}
      <audio ref={audioRef} hidden />
    </Card>
  );
};

export default RealisticAvatar;
