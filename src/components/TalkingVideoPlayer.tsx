import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { useTalkingVideo } from '@/hooks/useTalkingVideo';

interface TalkingVideoPlayerProps {
  imageUrl: string | null;
  audioUrl: string | null;
  isLoading?: boolean;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onVideoReady?: (videoUrl: string) => void;
  onAudioReady?: (audioUrl: string) => void;
}

const TalkingVideoPlayer = ({ 
  imageUrl, 
  audioUrl, 
  isLoading, 
  figureName,
  figureId,
  onVideoEnd, 
  onVideoReady,
  onAudioReady 
}: TalkingVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const processedAudioRef = useRef<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    generateVideo, 
    videoUrl, 
    isGenerating, 
    status, 
    reset 
  } = useTalkingVideo({
    onVideoReady: (url) => {
      console.log('🎥 Video ready from hook:', url);
      setCurrentVideoUrl(url);
      onVideoReady?.(url);
      // Stop the timer when video is ready
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    },
    onError: (error) => {
      console.error('❌ Video generation failed:', error);
      // Stop the timer on error
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      // Fallback: play audio only with static image
      if (audioUrl && audioRef.current) {
        console.log('🔊 Falling back to audio-only playback');
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
      }
    }
  });

  // Start timer when generating starts
  useEffect(() => {
    if (isGenerating) {
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
  }, [isGenerating]);

  // Generate video when we have both image and audio
  useEffect(() => {
    if (!imageUrl || !audioUrl) {
      console.log('⏸️ Missing image or audio URL');
      return;
    }

    // Prevent processing the same audio URL multiple times
    if (processedAudioRef.current === audioUrl) {
      console.log('⏭️ Already processed this audio URL, skipping');
      return;
    }

    // Mark this audio as processed
    processedAudioRef.current = audioUrl;
    
    console.log('🎬 Starting video generation for:', figureName);
    console.log('📸 Image:', imageUrl.substring(0, 50) + '...');
    console.log('🎵 Audio:', audioUrl.substring(0, 50) + '...');

    // Notify that audio is ready (for immediate playback if video fails)
    onAudioReady?.(audioUrl);

    // Generate talking video
    generateVideo(imageUrl, audioUrl, figureId, figureName);
  }, [imageUrl, audioUrl, figureName, figureId, generateVideo, onAudioReady]);

  // Play video when URL is available
  useEffect(() => {
    if (videoRef.current && currentVideoUrl) {
      console.log('🎬 Setting up video playback');
      
      videoRef.current.onloadeddata = () => {
        console.log('✅ Video loaded, attempting autoplay');
        setIsPlayingVideo(true);
        videoRef.current?.play().catch(err => {
          console.error('❌ Video autoplay failed:', err);
          setIsPlayingVideo(false);
        });
      };
      
      videoRef.current.onended = () => {
        console.log('📹 Video playback ended');
        setIsPlayingVideo(false);
        onVideoEnd?.();
      };
      
      videoRef.current.onerror = (err) => {
        console.error('❌ Video playback error:', err);
        setIsPlayingVideo(false);
      };
    }
  }, [currentVideoUrl, onVideoEnd]);

  // Reset on new figure
  useEffect(() => {
    if (figureId) {
      setCurrentVideoUrl(null);
      processedAudioRef.current = null;
      setLoadingSeconds(0);
    }
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

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(console.error);
    setIsPlayingVideo(true);
  };

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

  // Show portrait with generating overlay and timer
  if (isGenerating && imageUrl) {
    const statusMessage = status === 'generating' 
      ? 'Starting video generation...' 
      : 'Generating talking video...';
    
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <img 
          src={imageUrl} 
          alt="Avatar" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-white" />
            <p className="text-sm text-white font-medium">{statusMessage}</p>
            <p className="text-xs text-white/70">Creating lip-sync animation...</p>
            <p className="text-lg text-white font-bold">{loadingSeconds}s</p>
          </div>
        </div>
        {/* Hidden audio for fallback */}
        <audio ref={audioRef} hidden />
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

  // Show video if available with controls
  if (currentVideoUrl) {
    console.log('🎥 Rendering VIDEO element with URL:', currentVideoUrl);
    
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <video
          ref={videoRef}
          src={currentVideoUrl}
          autoPlay
          playsInline
          muted={false}
          controls={false}
          className="w-full h-full object-cover"
          onPlay={() => {
            console.log('▶️ Video started playing');
            setIsPlayingVideo(true);
          }}
          onEnded={() => {
            console.log('⏹️ Video ended');
            setIsPlayingVideo(false);
          }}
          onError={(e) => {
            console.error('❌ Video playback error:', e);
            setCurrentVideoUrl(null);
          }}
        />
        {/* Video controls in corner */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handleReplay}
            title="Replay"
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

  // Fallback to static image
  console.log('🖼️ Rendering STATIC IMAGE fallback');
  return (
    <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden">
      <img 
        src={imageUrl} 
        alt="Avatar" 
        className="w-full h-full object-cover"
      />
      {/* Hidden audio for playback */}
      <audio ref={audioRef} hidden />
    </Card>
  );
};

export default TalkingVideoPlayer;