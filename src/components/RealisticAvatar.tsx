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
  const processedAudioRef = useRef<string | null>(null); // Track processed audio URLs

  useEffect(() => {
    if (!imageUrl || !audioUrl) {
      console.log('⏸️ No image or audio URL provided');
      return;
    }

    // Prevent processing the same audio URL multiple times
    if (processedAudioRef.current === audioUrl) {
      console.log('⏭️ Already processed this audio URL, skipping');
      return;
    }

    // Mark this audio as processed immediately to prevent duplicates
    processedAudioRef.current = audioUrl;

    const generateVideo = async () => {
      try {
        setIsGenerating(true);
        setGenerationStatus('Generating animated avatar...');
        console.log('🎬 Starting A2E avatar generation');

        // Start generation and get taskId
        const { data, error } = await supabase.functions.invoke('a2e-generate-avatar', {
          body: {
            imageUrl,
            audioUrl,
            figureName: 'Historical Figure',
          },
        });

        if (error) {
          console.error('❌ A2E generation error:', error);
          throw error;
        }

        if (!data.success || !data.taskId) {
          throw new Error(data.error || 'Failed to start generation');
        }

        console.log('✅ Generation started, taskId:', data.taskId);
        
        // Poll for completion
        const maxAttempts = 60;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const { data: statusData, error: statusError } = await supabase.functions.invoke('a2e-check-status', {
            body: { taskId: data.taskId }
          });

          if (statusError) {
            console.error('Status check error:', statusError);
            attempts++;
            continue;
          }

          console.log(`📊 Status ${attempts + 1}:`, statusData.status);
          setGenerationStatus(`Processing... (${attempts * 5}s)`);

          if (statusData.status === 'completed' && statusData.videoUrl) {
            console.log('✅ Video ready:', statusData.videoUrl);
            setVideoUrl(statusData.videoUrl);
            setError(null);
            setIsGenerating(false);

            if (onVideoReady) {
              onVideoReady(statusData.videoUrl);
            }
            return;
          } else if (statusData.status === 'failed' || statusData.status === 'error') {
            throw new Error('Generation failed');
          }

          attempts++;
        }

        throw new Error('Generation timed out');
      } catch (err) {
        console.error('❌ Failed to generate avatar video:', err);
        setError('Failed to generate avatar video');
        setIsGenerating(false);
        
        // Fall back to just playing audio without video
        if (onVideoReady) {
          onVideoReady(audioUrl);
        }
      }
    };

    generateVideo();
  }, [imageUrl, audioUrl, onVideoReady]);

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
    console.log('🖼️ Rendering STATIC IMAGE fallback - error:', error, 'videoUrl:', videoUrl);
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

  // Render the video element
  console.log('🎥 Rendering VIDEO element with URL:', videoUrl);
  console.log('🎥 isGenerating:', isGenerating, 'error:', error);
  
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
