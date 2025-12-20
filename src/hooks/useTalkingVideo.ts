import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Dispatch event when video is generated for history widget
const dispatchVideoEvent = (url: string, figureName?: string) => {
  window.dispatchEvent(
    new CustomEvent("video-generated", { detail: { url, figureName } })
  );
};

interface VideoGenerationResult {
  status: 'idle' | 'generating' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  jobId: string | null;
  error: string | null;
}

interface UseTalkingVideoOptions {
  onVideoReady?: (videoUrl: string) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
  maxPollAttempts?: number;
  figureName?: string;
}

export function useTalkingVideo(options: UseTalkingVideoOptions = {}) {
  const {
    onVideoReady,
    onError,
    pollInterval = 3000,
    maxPollAttempts = 60, // 3 minutes max polling
    figureName: optionsFigureName,
  } = options;
  
  const currentFigureNameRef = useRef<string | undefined>(optionsFigureName);

  const [result, setResult] = useState<VideoGenerationResult>({
    status: 'idle',
    videoUrl: null,
    jobId: null,
    error: null,
  });

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const { toast } = useToast();

  // Clear polling
  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  // Poll for video status
  const pollForVideo = useCallback(async (jobId: string) => {
    pollCountRef.current += 1;
    
    if (pollCountRef.current > maxPollAttempts) {
      console.log('⏰ Max poll attempts reached');
      stopPolling();
      const errorMsg = 'Video generation timed out';
      setResult(prev => ({ ...prev, status: 'failed', error: errorMsg }));
      onError?.(errorMsg);
      return;
    }

    try {
      console.log(`🔄 Polling for video (attempt ${pollCountRef.current}/${maxPollAttempts})...`);
      
      const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
        body: { action: 'status', jobId },
      });

      if (error) throw error;

      console.log('📊 Poll result:', data.status);

      if (data.status === 'completed' && data.video) {
        console.log('✅ Video ready:', data.video);
        stopPolling();
        setResult({
          status: 'completed',
          videoUrl: data.video,
          jobId,
          error: null,
        });
        dispatchVideoEvent(data.video, currentFigureNameRef.current);
        onVideoReady?.(data.video);
        return;
      }

      if (data.status === 'failed') {
        console.log('❌ Video generation failed:', data.error);
        stopPolling();
        setResult({
          status: 'failed',
          videoUrl: null,
          jobId,
          error: data.error || 'Video generation failed',
        });
        onError?.(data.error || 'Video generation failed');
        return;
      }

      // Still processing - continue polling
      pollTimeoutRef.current = setTimeout(() => pollForVideo(jobId), pollInterval);
    } catch (err) {
      console.error('❌ Poll error:', err);
      stopPolling();
      const errorMsg = err instanceof Error ? err.message : 'Polling failed';
      setResult(prev => ({ ...prev, status: 'failed', error: errorMsg }));
      onError?.(errorMsg);
    }
  }, [maxPollAttempts, pollInterval, stopPolling, onVideoReady, onError]);

  // Generate talking video from image and audio
  const generateVideo = useCallback(async (
    imageUrl: string,
    audioUrl: string,
    figureId?: string,
    figureName?: string
  ): Promise<string | null> => {
    console.log('🎬 Starting video generation...');
    console.log('📸 Image:', imageUrl.substring(0, 50) + '...');
    console.log('🎵 Audio type:', audioUrl.startsWith('data:') ? 'base64' : 'url');

    // Store figureName for event dispatch
    currentFigureNameRef.current = figureName || optionsFigureName;

    stopPolling();
    setResult({
      status: 'generating',
      videoUrl: null,
      jobId: null,
      error: null,
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

      console.log('📋 Generation response:', data);

      // Immediate completion
      if (data.status === 'completed' && data.video) {
        console.log('✅ Video ready immediately:', data.video);
        setResult({
          status: 'completed',
          videoUrl: data.video,
          jobId: data.jobId,
          error: null,
        });
        dispatchVideoEvent(data.video, currentFigureNameRef.current);
        onVideoReady?.(data.video);
        return data.video;
      }

      // Async processing - start polling
      if (data.status === 'processing' && data.jobId) {
        console.log('⏳ Video processing, starting poll for job:', data.jobId);
        setResult(prev => ({
          ...prev,
          status: 'processing',
          jobId: data.jobId,
        }));
        pollTimeoutRef.current = setTimeout(() => pollForVideo(data.jobId), pollInterval);
        return null; // Video not ready yet
      }

      // Error
      throw new Error(data.error || 'Failed to start video generation');
    } catch (err) {
      console.error('❌ Video generation error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Video generation failed';
      setResult({
        status: 'failed',
        videoUrl: null,
        jobId: null,
        error: errorMsg,
      });
      onError?.(errorMsg);
      toast({
        title: 'Video Generation Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    }
  }, [stopPolling, pollForVideo, pollInterval, onVideoReady, onError, toast]);

  // Reset state
  const reset = useCallback(() => {
    stopPolling();
    setResult({
      status: 'idle',
      videoUrl: null,
      jobId: null,
      error: null,
    });
  }, [stopPolling]);

  return {
    ...result,
    isGenerating: result.status === 'generating' || result.status === 'processing',
    generateVideo,
    reset,
    stopPolling,
  };
}
