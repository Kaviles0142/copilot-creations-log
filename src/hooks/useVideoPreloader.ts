import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VideoPreloaderOptions {
  pollInterval?: number;
  maxPollAttempts?: number;
}

interface PreloadResult {
  videoUrl: string | null;
  error?: string;
}

export function useVideoPreloader(options: VideoPreloaderOptions = {}) {
  const { pollInterval = 3000, maxPollAttempts = 30 } = options;

  // Use refs instead of state to avoid stale closure issues
  const videosRef = useRef<Map<string, PreloadResult>>(new Map());
  const generatingRef = useRef<Set<string>>(new Set());
  const pollTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Stop polling for a specific key
  const stopPolling = useCallback((key: string) => {
    const timeout = pollTimeoutsRef.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      pollTimeoutsRef.current.delete(key);
    }
  }, []);

  // Poll for video status
  const pollForVideo = useCallback(async (
    key: string,
    jobId: string,
    attempt: number,
    resolve: (result: PreloadResult) => void
  ) => {
    if (attempt > maxPollAttempts) {
      console.log('⏰ Max poll attempts reached');
      const result = { videoUrl: null, error: 'Timeout' };
      videosRef.current.set(key, result);
      generatingRef.current.delete(key);
      stopPolling(key);
      resolve(result);
      return;
    }

    try {
      console.log(`🔄 Polling video status (${attempt}/${maxPollAttempts})...`);
      
      const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
        body: { action: 'status', jobId },
      });

      if (error) throw error;

      if (data.status === 'completed' && data.video) {
        console.log('✅ Video ready:', data.video.substring(0, 60) + '...');
        const result = { videoUrl: data.video };
        videosRef.current.set(key, result);
        generatingRef.current.delete(key);
        stopPolling(key);
        resolve(result);
        return;
      }

      if (data.status === 'failed') {
        console.log('❌ Video generation failed:', data.error);
        const result = { videoUrl: null, error: data.error || 'Generation failed' };
        videosRef.current.set(key, result);
        generatingRef.current.delete(key);
        stopPolling(key);
        resolve(result);
        return;
      }

      // Still processing - continue polling
      const timeout = setTimeout(() => {
        pollForVideo(key, jobId, attempt + 1, resolve);
      }, pollInterval);
      pollTimeoutsRef.current.set(key, timeout);
      
    } catch (err) {
      console.error('❌ Poll error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Polling failed';
      const result = { videoUrl: null, error: errorMsg };
      videosRef.current.set(key, result);
      generatingRef.current.delete(key);
      stopPolling(key);
      resolve(result);
    }
  }, [maxPollAttempts, pollInterval, stopPolling]);

  // Generate and wait for video - returns a promise
  // NOTE: Each call generates a NEW video - no caching by audio content
  // Caching caused issues where greeting videos were replayed for responses
  const generateVideo = useCallback(async (
    imageUrl: string,
    audioUrl: string,
    figureId?: string,
    figureName?: string
  ): Promise<PreloadResult> => {
    // Use timestamp to ensure unique key for each generation request
    const uniqueId = Date.now().toString();
    const key = `${figureId || 'unknown'}-${uniqueId}`;
    
    console.log('🎬 Starting new video generation (no cache):', figureName || figureId);

    // Skip if already generating - wait for it
    if (generatingRef.current.has(key)) {
      console.log('⏳ Already generating, waiting...');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const result = videosRef.current.get(key);
          if (result) {
            clearInterval(checkInterval);
            resolve(result);
          }
          if (!generatingRef.current.has(key) && !result) {
            clearInterval(checkInterval);
            resolve({ videoUrl: null, error: 'Generation stopped' });
          }
        }, 500);
      });
    }

    console.log('🎬 Starting video generation for:', figureName || figureId);
    generatingRef.current.add(key);

    try {
      const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
        body: {
          action: 'start',
          imageUrl,
          audioUrl,
          figureId,
          figureName,
        },
      });

      if (error) throw error;

      // Immediate completion
      if (data.status === 'completed' && data.video) {
        console.log('✅ Video ready immediately:', data.video.substring(0, 60) + '...');
        const result = { videoUrl: data.video };
        videosRef.current.set(key, result);
        generatingRef.current.delete(key);
        return result;
      }

      // Async processing - poll for completion
      if (data.status === 'processing' && data.jobId) {
        console.log('⏳ Video processing, starting poll...');
        return new Promise((resolve) => {
          pollForVideo(key, data.jobId, 1, resolve);
        });
      }

      throw new Error(data.error || 'Failed to start video generation');
      
    } catch (err) {
      console.error('❌ Video generation error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Generation failed';
      const result = { videoUrl: null, error: errorMsg };
      videosRef.current.set(key, result);
      generatingRef.current.delete(key);
      return result;
    }
  }, [pollForVideo]);

  // Clear cache for a figure
  const clearCache = useCallback((figureId: string) => {
    const keysToDelete: string[] = [];
    videosRef.current.forEach((_, key) => {
      if (key.startsWith(figureId)) {
        keysToDelete.push(key);
        stopPolling(key);
      }
    });
    keysToDelete.forEach(key => videosRef.current.delete(key));
    generatingRef.current.forEach(key => {
      if (key.startsWith(figureId)) {
        generatingRef.current.delete(key);
      }
    });
  }, [stopPolling]);

  // Clear all
  const clearAll = useCallback(() => {
    pollTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pollTimeoutsRef.current.clear();
    videosRef.current.clear();
    generatingRef.current.clear();
  }, []);

  return {
    generateVideo,
    clearCache,
    clearAll,
  };
}
