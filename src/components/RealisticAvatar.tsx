import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
import { useTalkingVideo } from '@/hooks/useTalkingVideo';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  figureName?: string;
  figureId?: string;
  onVideoEnd?: () => void;
  onVideoReady?: (videoUrl: string) => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl, 
  figureName,
  figureId,
  onVideoEnd, 
  onVideoReady 
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedAudioRef = useRef<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const { 
    generateVideo, 
    videoUrl: generatedVideoUrl, 
    isGenerating, 
    status,
    reset 
  } = useTalkingVideo({
    onVideoReady: (url) => {
      console.log('🎥 Ditto video ready:', url);
      setCurrentVideoUrl(url);
      onVideoReady?.(url);
    },
    onError: (error) => {
      console.error('❌ Ditto video generation failed:', error);
      // Fallback: just notify that audio is ready (no video)
      if (audioUrl) {
        console.log('🔊 Falling back to audio-only mode');
        onVideoReady?.(audioUrl);
      }
    }
  });

  // Generate video when we have both image and audio
  useEffect(() => {
    if (!imageUrl || !audioUrl) {
      console.log('⏸️ No image or audio URL provided');
      return;
    }

    // CRITICAL: Stop any currently playing video before processing new audio
    if (videoRef.current) {
      console.log('⏹️ Stopping previous video before new generation');
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Clear old video URL to show static image during generation
    if (currentVideoUrl && processedAudioRef.current !== audioUrl) {
      console.log('🧹 Clearing old video URL');
      setCurrentVideoUrl(null);
      setIsPlayingVideo(false);
    }

    // Prevent processing the same audio URL multiple times
    if (processedAudioRef.current === audioUrl) {
      console.log('⏭️ Already processed this audio URL, skipping');
      return;
    }

    // Mark this audio as processed
    processedAudioRef.current = audioUrl;
    
    console.log('🎬 Starting Ditto video generation');
    console.log('📸 Image:', imageUrl.substring(0, 60) + '...');
    console.log('🎵 Audio type:', audioUrl.startsWith('data:') ? 'base64' : 'url');

    // Generate talking video using Ditto API
    generateVideo(imageUrl, audioUrl, figureId, figureName);
  }, [imageUrl, audioUrl, figureName, figureId, generateVideo, currentVideoUrl]);

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
        setCurrentVideoUrl(null);
      };
    }
  }, [currentVideoUrl, onVideoEnd]);

  // Reset video state when figure changes
  useEffect(() => {
    if (figureId) {
      setCurrentVideoUrl(null);
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

  // Show portrait with generating overlay
  if (isGenerating && imageUrl) {
    const statusMessage = status === 'generating' 
      ? 'Starting video generation...' 
      : 'Creating lip-sync animation...';
    
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
            <p className="text-xs text-white/70">This can take 30-60 seconds...</p>
          </div>
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

  // Show video if available
  if (currentVideoUrl) {
    console.log('🎥 Rendering VIDEO element with URL:', currentVideoUrl.substring(0, 60) + '...');
    
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
    </Card>
  );
};

export default RealisticAvatar;
