import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PreloadedVideo {
  audioUrl: string;
  videoUrl: string | null;
  status: 'generating' | 'ready' | 'failed';
  error?: string;
}

interface VideoPreloaderOptions {
  onVideoReady?: (audioUrl: string, videoUrl: string) => void;
  onError?: (audioUrl: string, error: string) => void;
  pollInterval?: number;
  maxPollAttempts?: number;
}

export function useVideoPreloader(options: VideoPreloaderOptions = {}) {
  const {
    onVideoReady,
    onError,
    pollInterval = 3000,
    maxPollAttempts = 60,
  } = options;

  const [preloadedVideos, setPreloadedVideos] = useState<Map<string, PreloadedVideo>>(new Map());
  const [currentlyGenerating, setCurrentlyGenerating] = useState<Set<string>>(new Set());
  const pollTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollCountsRef = useRef<Map<string, number>>(new Map());

  // Stop polling for a specific audio URL
  const stopPolling = useCallback((audioUrl: string) => {
    const timeout = pollTimeoutsRef.current.get(audioUrl);
    if (timeout) {
      clearTimeout(timeout);
      pollTimeoutsRef.current.delete(audioUrl);
    }
    pollCountsRef.current.delete(audioUrl);
  }, []);

  // Stop all polling
  const stopAllPolling = useCallback(() => {
    pollTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pollTimeoutsRef.current.clear();
    pollCountsRef.current.clear();
  }, []);

  // Poll for video status
  const pollForVideo = useCallback(async (audioUrl: string, jobId: string) => {
    const count = (pollCountsRef.current.get(audioUrl) || 0) + 1;
    pollCountsRef.current.set(audioUrl, count);

    if (count > maxPollAttempts) {
      console.log('⏰ Max poll attempts reached for preload');
      stopPolling(audioUrl);
      setPreloadedVideos(prev => {
        const newMap = new Map(prev);
        newMap.set(audioUrl, { audioUrl, videoUrl: null, status: 'failed', error: 'Timeout' });
        return newMap;
      });
      setCurrentlyGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(audioUrl);
        return newSet;
      });
      onError?.(audioUrl, 'Video generation timed out');
      return;
    }

    try {
      console.log(`🔄 Preload polling (attempt ${count}/${maxPollAttempts})...`);
      
      const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
        body: { action: 'status', jobId },
      });

      if (error) throw error;

      if (data.status === 'completed' && data.video) {
        console.log('✅ Preloaded video ready:', data.video);
        stopPolling(audioUrl);
        setPreloadedVideos(prev => {
          const newMap = new Map(prev);
          newMap.set(audioUrl, { audioUrl, videoUrl: data.video, status: 'ready' });
          return newMap;
        });
        setCurrentlyGenerating(prev => {
          const newSet = new Set(prev);
          newSet.delete(audioUrl);
          return newSet;
        });
        onVideoReady?.(audioUrl, data.video);
        return;
      }

      if (data.status === 'failed') {
        console.log('❌ Preload video generation failed:', data.error);
        stopPolling(audioUrl);
        setPreloadedVideos(prev => {
          const newMap = new Map(prev);
          newMap.set(audioUrl, { audioUrl, videoUrl: null, status: 'failed', error: data.error });
          return newMap;
        });
        setCurrentlyGenerating(prev => {
          const newSet = new Set(prev);
          newSet.delete(audioUrl);
          return newSet;
        });
        onError?.(audioUrl, data.error || 'Video generation failed');
        return;
      }

      // Still processing - continue polling
      const timeout = setTimeout(() => pollForVideo(audioUrl, jobId), pollInterval);
      pollTimeoutsRef.current.set(audioUrl, timeout);
    } catch (err) {
      console.error('❌ Preload poll error:', err);
      stopPolling(audioUrl);
      const errorMsg = err instanceof Error ? err.message : 'Polling failed';
      setPreloadedVideos(prev => {
        const newMap = new Map(prev);
        newMap.set(audioUrl, { audioUrl, videoUrl: null, status: 'failed', error: errorMsg });
        return newMap;
      });
      setCurrentlyGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(audioUrl);
        return newSet;
      });
      onError?.(audioUrl, errorMsg);
    }
  }, [maxPollAttempts, pollInterval, stopPolling, onVideoReady, onError]);

  // Start preloading a video
  const preloadVideo = useCallback(async (
    imageUrl: string,
    audioUrl: string,
    figureId?: string,
    figureName?: string
  ): Promise<void> => {
    // Skip if already preloading or preloaded
    if (currentlyGenerating.has(audioUrl) || preloadedVideos.has(audioUrl)) {
      console.log('⏭️ Already preloading/preloaded this video');
      return;
    }

    console.log('🎬 Starting video preload for:', figureName || figureId);
    
    setCurrentlyGenerating(prev => new Set(prev).add(audioUrl));
    setPreloadedVideos(prev => {
      const newMap = new Map(prev);
      newMap.set(audioUrl, { audioUrl, videoUrl: null, status: 'generating' });
      return newMap;
    });

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
        console.log('✅ Preloaded video ready immediately:', data.video);
        setPreloadedVideos(prev => {
          const newMap = new Map(prev);
          newMap.set(audioUrl, { audioUrl, videoUrl: data.video, status: 'ready' });
          return newMap;
        });
        setCurrentlyGenerating(prev => {
          const newSet = new Set(prev);
          newSet.delete(audioUrl);
          return newSet;
        });
        onVideoReady?.(audioUrl, data.video);
        return;
      }

      // Async processing - start polling
      if (data.status === 'processing' && data.jobId) {
        console.log('⏳ Preload video processing, starting poll for job:', data.jobId);
        const timeout = setTimeout(() => pollForVideo(audioUrl, data.jobId), pollInterval);
        pollTimeoutsRef.current.set(audioUrl, timeout);
        return;
      }

      throw new Error(data.error || 'Failed to start video preload');
    } catch (err) {
      console.error('❌ Video preload error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Video preload failed';
      setPreloadedVideos(prev => {
        const newMap = new Map(prev);
        newMap.set(audioUrl, { audioUrl, videoUrl: null, status: 'failed', error: errorMsg });
        return newMap;
      });
      setCurrentlyGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(audioUrl);
        return newSet;
      });
      onError?.(audioUrl, errorMsg);
    }
  }, [currentlyGenerating, preloadedVideos, pollForVideo, pollInterval, onVideoReady, onError]);

  // Get preloaded video URL for an audio URL
  const getPreloadedVideo = useCallback((audioUrl: string): PreloadedVideo | undefined => {
    return preloadedVideos.get(audioUrl);
  }, [preloadedVideos]);

  // Check if video is ready
  const isVideoReady = useCallback((audioUrl: string): boolean => {
    const video = preloadedVideos.get(audioUrl);
    return video?.status === 'ready' && !!video.videoUrl;
  }, [preloadedVideos]);

  // Check if video is currently generating
  const isVideoGenerating = useCallback((audioUrl: string): boolean => {
    return currentlyGenerating.has(audioUrl) || preloadedVideos.get(audioUrl)?.status === 'generating';
  }, [currentlyGenerating, preloadedVideos]);

  // Wait for video to be ready (returns promise)
  const waitForVideo = useCallback((audioUrl: string, timeout = 90000): Promise<string | null> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        const video = preloadedVideos.get(audioUrl);
        
        if (video?.status === 'ready' && video.videoUrl) {
          resolve(video.videoUrl);
          return;
        }
        
        if (video?.status === 'failed') {
          resolve(null);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log('⏰ Wait for video timeout');
          resolve(null);
          return;
        }
        
        setTimeout(check, 500);
      };
      
      check();
    });
  }, [preloadedVideos]);

  // Clear a specific preloaded video
  const clearPreloadedVideo = useCallback((audioUrl: string) => {
    stopPolling(audioUrl);
    setPreloadedVideos(prev => {
      const newMap = new Map(prev);
      newMap.delete(audioUrl);
      return newMap;
    });
    setCurrentlyGenerating(prev => {
      const newSet = new Set(prev);
      newSet.delete(audioUrl);
      return newSet;
    });
  }, [stopPolling]);

  // Clear all preloaded videos
  const clearAll = useCallback(() => {
    stopAllPolling();
    setPreloadedVideos(new Map());
    setCurrentlyGenerating(new Set());
  }, [stopAllPolling]);

  return {
    preloadVideo,
    getPreloadedVideo,
    isVideoReady,
    isVideoGenerating,
    waitForVideo,
    clearPreloadedVideo,
    clearAll,
    preloadedVideos,
    currentlyGenerating: currentlyGenerating.size > 0,
  };
}
