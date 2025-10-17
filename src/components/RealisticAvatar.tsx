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
}

const RealisticAvatar = ({ imageUrl, isLoading, audioUrl, onVideoEnd }: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl || !audioUrl) {
      console.log('⏸️ No image or audio URL provided');
      return;
    }

    const generateRealisticVideo = async () => {
      try {
        setIsGenerating(true);
        setError(null);
        console.log('🎬 Starting realistic avatar generation...');
        console.log('📸 Image:', imageUrl);
        console.log('🎤 Audio:', audioUrl);

        // Start the generation
        const { data: startData, error: startError } = await supabase.functions.invoke('animate-avatar-sadtalker', {
          body: {
            imageUrl,
            audioUrl
          }
        });

        if (startError) {
          throw startError;
        }

        if (!startData?.predictionId) {
          throw new Error('No prediction ID returned');
        }

        console.log('⏳ Prediction started:', startData.predictionId);
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const { data: checkData, error: checkError } = await supabase.functions.invoke('check-prediction', {
            body: {
              predictionId: startData.predictionId
            }
          });

          if (checkError) {
            throw checkError;
          }

          console.log(`📊 Status check ${attempts + 1}:`, checkData.status);

          if (checkData.status === 'succeeded') {
            console.log('✅ Video ready:', checkData.output);
            setVideoUrl(checkData.output);
            return;
          } else if (checkData.status === 'failed') {
            throw new Error(checkData.error || 'Video generation failed');
          }

          attempts++;
        }

        throw new Error('Video generation timed out');
        
      } catch (err) {
        console.error('❌ Error generating realistic avatar:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate video');
        toast.error('Failed to generate realistic avatar', {
          description: 'Falling back to static image'
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateRealisticVideo();
  }, [imageUrl, audioUrl]);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.onended = () => {
        console.log('📹 Video playback ended');
        onVideoEnd?.();
      };
    }
  }, [videoUrl, onVideoEnd]);

  if (isLoading || isGenerating) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">
            {isGenerating ? 'Generating photorealistic avatar...' : 'Loading...'}
          </p>
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
        className="w-full h-full object-cover"
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
