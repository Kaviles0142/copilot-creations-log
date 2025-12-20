import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
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
    },
    onError: (error) => {
      console.error('❌ Video generation failed:', error);
      // Fallback: play audio only with static image
      if (audioUrl && audioRef.current) {
        console.log('🔊 Falling back to audio-only playback');
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
      }
    }
  });

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
    }
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

  // Show portrait with generating overlay
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

  // Show video if available
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
        {isPlayingVideo && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
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
