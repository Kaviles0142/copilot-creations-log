import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IdleVideoCache {
  [figureId: string]: {
    videoUrl: string | null;
    isGenerating: boolean;
    error?: string;
  };
}

interface UseIdleVideoPreloaderReturn {
  getIdleVideoUrl: (figureId: string, imageBase64: string, figureName?: string) => Promise<string | null>;
  isGenerating: (figureId: string) => boolean;
  preloadIdleVideo: (figureId: string, imageBase64: string, figureName?: string) => void;
  getCachedUrl: (figureId: string) => string | null;
  clearCache: () => void;
}

export function useIdleVideoPreloader(): UseIdleVideoPreloaderReturn {
  const [cache, setCache] = useState<IdleVideoCache>({});
  const pendingRequests = useRef<Map<string, Promise<string | null>>>(new Map());

  const updateCache = useCallback((figureId: string, update: Partial<IdleVideoCache[string]>) => {
    setCache(prev => ({
      ...prev,
      [figureId]: {
        ...prev[figureId],
        videoUrl: prev[figureId]?.videoUrl || null,
        isGenerating: prev[figureId]?.isGenerating || false,
        ...update,
      },
    }));
  }, []);

  const generateIdleVideo = useCallback(async (
    figureId: string, 
    imageBase64: string, 
    figureName?: string
  ): Promise<string | null> => {
    // Check if already cached
    if (cache[figureId]?.videoUrl) {
      return cache[figureId].videoUrl;
    }

    // Check if already generating
    const pendingRequest = pendingRequests.current.get(figureId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Start generation
    updateCache(figureId, { isGenerating: true, error: undefined });

    const request = (async () => {
      try {
        console.log(`🎬 Requesting idle video for ${figureName || figureId}...`);

        const { data, error } = await supabase.functions.invoke('generate-idle-loop', {
          body: { 
            imageBase64, 
            figureId, 
            figureName 
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to generate idle video');
        }

        const videoUrl = data?.videoUrl;
        
        if (videoUrl) {
          console.log(`✅ Idle video ready for ${figureName || figureId}:`, data.cached ? '(cached)' : '(new)');
          updateCache(figureId, { videoUrl, isGenerating: false });
          return videoUrl;
        } else {
          throw new Error('No video URL returned');
        }
      } catch (error) {
        console.error(`❌ Failed to generate idle video for ${figureName || figureId}:`, error);
        updateCache(figureId, { 
          isGenerating: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return null;
      } finally {
        pendingRequests.current.delete(figureId);
      }
    })();

    pendingRequests.current.set(figureId, request);
    return request;
  }, [cache, updateCache]);

  const getIdleVideoUrl = useCallback(async (
    figureId: string, 
    imageBase64: string, 
    figureName?: string
  ): Promise<string | null> => {
    return generateIdleVideo(figureId, imageBase64, figureName);
  }, [generateIdleVideo]);

  const isGenerating = useCallback((figureId: string): boolean => {
    return cache[figureId]?.isGenerating || false;
  }, [cache]);

  const preloadIdleVideo = useCallback((
    figureId: string, 
    imageBase64: string, 
    figureName?: string
  ): void => {
    // Fire and forget
    generateIdleVideo(figureId, imageBase64, figureName);
  }, [generateIdleVideo]);

  const getCachedUrl = useCallback((figureId: string): string | null => {
    return cache[figureId]?.videoUrl || null;
  }, [cache]);

  const clearCache = useCallback((): void => {
    setCache({});
    pendingRequests.current.clear();
  }, []);

  return {
    getIdleVideoUrl,
    isGenerating,
    preloadIdleVideo,
    getCachedUrl,
    clearCache,
  };
}
