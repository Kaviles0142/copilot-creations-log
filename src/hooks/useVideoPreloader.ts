import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VideoPreloaderOptions {
  frameCount?: number;
}

interface AnimationFrame {
  frameNumber: number;
  imageUrl: string;
  speechSegment: string;
}

interface PreloadResult {
  videoUrl: string | null;
  frames?: AnimationFrame[];
  error?: string;
}

export function useVideoPreloader(options: VideoPreloaderOptions = {}) {
  const { frameCount = 5 } = options;

  // Use refs instead of state to avoid stale closure issues
  const videosRef = useRef<Map<string, PreloadResult>>(new Map());
  const generatingRef = useRef<Set<string>>(new Set());

  // Generate K2 animated frames
  const generateK2Animation = useCallback(async (
    imageUrl: string,
    text: string,
    figureId?: string,
    figureName?: string
  ): Promise<PreloadResult> => {
    const uniqueId = Date.now().toString();
    const key = `k2-${figureId || 'unknown'}-${uniqueId}`;
    
    console.log('🎬 Starting K2 + Nano Banana animation:', figureName || figureId);
    generatingRef.current.add(key);

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

      console.log(`✅ K2 Animation complete: ${data.frames.length} frames`);
      const result: PreloadResult = { 
        videoUrl: null, 
        frames: data.frames 
      };
      videosRef.current.set(key, result);
      generatingRef.current.delete(key);
      return result;
      
    } catch (err) {
      console.error('❌ K2 animation error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Animation failed';
      const result = { videoUrl: null, error: errorMsg };
      videosRef.current.set(key, result);
      generatingRef.current.delete(key);
      return result;
    }
  }, [frameCount]);

  // Clear cache for a figure
  const clearCache = useCallback((figureId: string) => {
    const keysToDelete: string[] = [];
    videosRef.current.forEach((_, key) => {
      if (key.startsWith(figureId) || key.includes(figureId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => videosRef.current.delete(key));
    generatingRef.current.forEach(key => {
      if (key.startsWith(figureId) || key.includes(figureId)) {
        generatingRef.current.delete(key);
      }
    });
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    videosRef.current.clear();
    generatingRef.current.clear();
  }, []);

  return {
    generateK2Animation,
    clearCache,
    clearAll,
  };
}
