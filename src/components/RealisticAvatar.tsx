import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
import { useTalkingVideo } from '@/hooks/useTalkingVideo';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  // Either pass audioUrl for internal video generation
  audioUrl?: string | null;
  // Or pass videoUrl directly (pre-generated)
  videoUrl?: string | null;
  isGeneratingVideo?: boolean;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onVideoReady?: (videoUrl: string) => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl,
  videoUrl: externalVideoUrl,
  isGeneratingVideo: externalIsGenerating,
  figureName,
  figureId,
  onVideoEnd,
  onVideoReady,
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedAudioRef = useRef<string | null>(null);
  const [internalVideoUrl, setInternalVideoUrl] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
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

  // Generate video internally when we have image + audio but no external video
  useEffect(() => {
    if (!imageUrl || !audioUrl || externalVideoUrl) {
      return;
    }

    // Prevent re-processing same audio
    if (processedAudioRef.current === audioUrl) {
      return;
    }

    processedAudioRef.current = audioUrl;
    console.log('🎬 Starting internal video generation');
    generateVideo(imageUrl, audioUrl, figureId, figureName);
  }, [imageUrl, audioUrl, externalVideoUrl, figureId, figureName, generateVideo]);

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
      reset();
    }
  }, [figureId, reset]);

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
  if (isGeneratingVideo && !videoUrl) {
    const statusMessage = status === 'generating' 
      ? 'Starting video generation...' 
      : 'Creating lip-sync animation...';
    
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
            <p className="text-xs text-white/70">This can take 30-60 seconds...</p>
          </div>
        </div>
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
    </Card>
  );
};

export default RealisticAvatar;
