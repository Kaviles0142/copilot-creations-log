import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  onVideoEnd?: () => void;
  onVideoReady?: (videoUrl: string) => void;
}

const RealisticAvatar = ({ imageUrl, isLoading, audioUrl, onVideoEnd, onVideoReady }: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>(''); // Track current status

  useEffect(() => {
    if (!imageUrl || !audioUrl) {
      console.log('⏸️ No image or audio URL provided');
      return;
    }

    // Clear previous video to trigger new generation
    setVideoUrl(null);
    setError(null);

    const generateRealisticVideo = async () => {
      try {
        setIsGenerating(true);
        setError(null);
        console.log('🎬 Starting avatar animation with fal.ai');
        console.log('📸 Image:', imageUrl);
        console.log('🎤 Audio:', audioUrl);

        setGenerationStatus('Animating your avatar... This may take 1-2 minutes');

        // Start the generation (fire and forget)
        supabase.functions.invoke('fal-animate-avatar', {
          body: { imageUrl, audioUrl }
        }).then(({ data, error: functionError }) => {
          if (functionError) {
            console.error('❌ Animation error:', functionError);
            setError(functionError.message || 'Failed to animate avatar');
            setIsGenerating(false);
            toast.error('Failed to generate realistic avatar', {
              description: 'Falling back to static image'
            });
            return;
          }

          if (!data?.videoUrl) {
            console.error('❌ No video URL returned');
            setError('No video URL returned');
            setIsGenerating(false);
            return;
          }

          console.log('✅ Video ready:', data.videoUrl);
          setVideoUrl(data.videoUrl);
          setGenerationStatus('Avatar ready!');
          setIsGenerating(false);
          
          onVideoReady?.(data.videoUrl);
        }).catch(err => {
          console.error('❌ Error generating realistic avatar:', err);
          setError(err instanceof Error ? err.message : 'Failed to generate video');
          setIsGenerating(false);
          toast.error('Video generation in progress', {
            description: 'This is taking longer than expected, showing static image'
          });
        });
        
      } catch (err) {
        console.error('❌ Error starting video generation:', err);
        setError(err instanceof Error ? err.message : 'Failed to start generation');
        setIsGenerating(false);
      }
    };

    generateRealisticVideo();
  }, [imageUrl, audioUrl]);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      console.log('🎬 Setting up video playback with audio');
      
      videoRef.current.onloadeddata = () => {
        console.log('✅ Video loaded, attempting autoplay');
        videoRef.current?.play().catch(err => {
          console.error('❌ Video autoplay failed:', err);
        });
      };
      
      videoRef.current.onended = () => {
        console.log('📹 Video playback ended');
        onVideoEnd?.();
      };
      
      videoRef.current.onerror = (err) => {
        console.error('❌ Video playback error:', err);
      };
    }
  }, [videoUrl, onVideoEnd]);

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

  // Show portrait with overlay when generating video
  if (isGenerating && imageUrl) {
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
            <p className="text-sm text-white font-medium">{generationStatus}</p>
            <p className="text-xs text-white/70">This can take 1-3 minutes...</p>
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

  if (error || !videoUrl) {
    // Fallback to static image if video generation fails
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden">
        <img 
          src={imageUrl} 
          alt="Avatar" 
          className="w-full h-full object-cover"
        />
      </Card>
    );
  }

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
        onLoadedData={() => {
          console.log('✅ Video loaded and ready to play');
          videoRef.current?.play().catch(err => {
            console.error('❌ Autoplay blocked:', err);
          });
        }}
        onPlay={() => console.log('▶️ Video started playing')}
        onEnded={() => console.log('⏹️ Video ended')}
        onError={(e) => {
          console.error('❌ Video playback error:', e);
          setError('Video playback failed');
        }}
      />
      {isGenerating && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
        </div>
      )}
    </Card>
  );
};

export default RealisticAvatar;
