import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnimationFrame {
  frameNumber: number;
  imageUrl: string;
  speechSegment: string;
}

interface K2AnimationResult {
  status: 'idle' | 'generating' | 'completed' | 'failed';
  frames: AnimationFrame[];
  currentFrameIndex: number;
  error: string | null;
}

interface UseK2AnimationOptions {
  onAnimationReady?: (frames: AnimationFrame[]) => void;
  onError?: (error: string) => void;
  frameCount?: number;
  frameDuration?: number; // ms per frame
}

export function useK2Animation(options: UseK2AnimationOptions = {}) {
  const {
    onAnimationReady,
    onError,
    frameCount = 5,
    frameDuration = 800, // Default 800ms per frame
  } = options;

  const [result, setResult] = useState<K2AnimationResult>({
    status: 'idle',
    frames: [],
    currentFrameIndex: 0,
    error: null,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Stop animation playback
  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Play animation frames synced with audio
  const playAnimation = useCallback((frames: AnimationFrame[], audioUrl?: string, audioDurationMs?: number) => {
    if (frames.length === 0) return;

    stopAnimation();
    setIsPlaying(true);
    setResult(prev => ({ ...prev, currentFrameIndex: 0 }));

    // Calculate frame timing based on audio duration or default
    const totalDuration = audioDurationMs || frames.length * frameDuration;
    const msPerFrame = totalDuration / frames.length;

    console.log(`🎬 Playing ${frames.length} frames over ${totalDuration}ms (${msPerFrame}ms per frame)`);

    // Play audio if provided
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(err => {
        console.error('Audio playback failed:', err);
      });
    }

    let frameIndex = 0;
    animationIntervalRef.current = setInterval(() => {
      frameIndex++;
      if (frameIndex >= frames.length) {
        stopAnimation();
        setResult(prev => ({ ...prev, currentFrameIndex: 0 }));
        return;
      }
      setResult(prev => ({ ...prev, currentFrameIndex: frameIndex }));
    }, msPerFrame);
  }, [frameDuration, stopAnimation]);

  // Generate animation frames using K2 + nano banana
  const generateAnimation = useCallback(async (
    imageUrl: string,
    text: string,
    figureId?: string,
    figureName?: string,
    audioUrl?: string
  ): Promise<AnimationFrame[] | null> => {
    console.log('🎬 Starting K2 + Nano Banana animation generation...');
    console.log('📸 Image:', imageUrl.substring(0, 50) + '...');
    console.log('📝 Text:', text.substring(0, 50) + '...');

    stopAnimation();
    setResult({
      status: 'generating',
      frames: [],
      currentFrameIndex: 0,
      error: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke('k2-animate-portrait', {
        body: {
          imageUrl,
          text,
          figureName,
          figureId,
          frameCount,
        },
      });

      if (error) throw error;

      if (!data.success || !data.frames || data.frames.length === 0) {
        throw new Error(data.error || 'No frames generated');
      }

      console.log(`✅ Generated ${data.frames.length} animation frames`);

      const frames: AnimationFrame[] = data.frames;
      setResult({
        status: 'completed',
        frames,
        currentFrameIndex: 0,
        error: null,
      });

      onAnimationReady?.(frames);

      // Auto-play if we have audio
      if (audioUrl) {
        // Estimate audio duration (rough: ~150ms per character for speech)
        const estimatedDuration = text.length * 80;
        playAnimation(frames, audioUrl, estimatedDuration);
      }

      return frames;
    } catch (err) {
      console.error('❌ Animation generation error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Animation generation failed';
      setResult({
        status: 'failed',
        frames: [],
        currentFrameIndex: 0,
        error: errorMsg,
      });
      onError?.(errorMsg);
      toast({
        title: 'Animation Generation Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    }
  }, [frameCount, stopAnimation, onAnimationReady, onError, playAnimation, toast]);

  // Reset state
  const reset = useCallback(() => {
    stopAnimation();
    setResult({
      status: 'idle',
      frames: [],
      currentFrameIndex: 0,
      error: null,
    });
  }, [stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  // Get current frame image
  const currentFrame = result.frames[result.currentFrameIndex] || null;
  const currentFrameUrl = currentFrame?.imageUrl || null;

  return {
    ...result,
    isGenerating: result.status === 'generating',
    isPlaying,
    currentFrame,
    currentFrameUrl,
    generateAnimation,
    playAnimation,
    stopAnimation,
    reset,
    audioRef,
  };
}
