import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getChunkConfig, AudioChunk } from '@/utils/audioChunker';

interface VideoChunk {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  jobId?: string;
  videoUrl?: string;
  error?: string;
}

interface ChunkedVideoState {
  isGenerating: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  completedChunks: VideoChunk[];
  pendingChunks: VideoChunk[];
  currentVideoUrl: string | null;
  error: string | null;
}

const MAX_CONCURRENT_CHUNKS = 2; // Generate 2 chunks at a time

export function useChunkedVideoGeneration() {
  const [state, setState] = useState<ChunkedVideoState>({
    isGenerating: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    completedChunks: [],
    pendingChunks: [],
    currentVideoUrl: null,
    error: null,
  });

  const videoQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const onVideoReadyRef = useRef<((url: string) => void) | null>(null);
  const onAllCompleteRef = useRef<(() => void) | null>(null);

  // Poll for a single chunk's completion
  const pollChunkCompletion = useCallback(async (
    jobId: string,
    chunkIndex: number,
    maxAttempts = 60
  ): Promise<string | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
          body: { action: 'status', jobId }
        });

        if (error) throw error;

        if (data.status === 'completed' && data.video) {
          console.log(`✅ Chunk ${chunkIndex} video ready`);
          return data.video;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'Chunk video generation failed');
        }

        // Still processing - wait 3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err) {
        console.error(`❌ Chunk ${chunkIndex} poll error:`, err);
        if (attempt === maxAttempts) return null;
      }
    }
    return null;
  }, []);

  // Start generating a single chunk
  const generateChunk = useCallback(async (
    chunk: AudioChunk,
    imageUrl: string,
    figureId: string,
    figureName: string
  ): Promise<{ jobId: string; index: number } | null> => {
    try {
      console.log(`🎬 Starting chunk ${chunk.index} video generation...`);
      
      const { data, error } = await supabase.functions.invoke('ditto-generate-video', {
        body: {
          action: 'start',
          imageUrl,
          audioUrl: chunk.dataUrl,
          figureId,
          figureName: `${figureName}_chunk${chunk.index}`
        }
      });

      if (error) throw error;

      if (data.status === 'completed' && data.video) {
        // Rare: video ready immediately
        return { jobId: data.video, index: chunk.index }; // Using video URL as "jobId" for immediate
      }

      if (data.jobId) {
        return { jobId: data.jobId, index: chunk.index };
      }

      throw new Error('No job ID returned');
    } catch (err) {
      console.error(`❌ Chunk ${chunk.index} start error:`, err);
      return null;
    }
  }, []);

  // Main function to generate chunked video
  const generateChunkedVideo = useCallback(async (
    imageUrl: string,
    audioDataUrl: string,
    figureId: string,
    figureName: string,
    onVideoReady: (url: string) => void,
    onAllComplete: () => void
  ) => {
    const { shouldChunk, chunks, totalDuration } = getChunkConfig(audioDataUrl);
    
    console.log(`🎬 Video generation: ${chunks.length} chunk(s), ~${totalDuration.toFixed(0)}s total`);

    onVideoReadyRef.current = onVideoReady;
    onAllCompleteRef.current = onAllComplete;
    videoQueueRef.current = [];
    isPlayingRef.current = false;

    setState({
      isGenerating: true,
      currentChunkIndex: 0,
      totalChunks: chunks.length,
      completedChunks: [],
      pendingChunks: chunks.map(c => ({ index: c.index, status: 'pending' })),
      currentVideoUrl: null,
      error: null,
    });

    // Process chunks in batches
    const processChunks = async () => {
      const activeJobs: Map<number, string> = new Map(); // index -> jobId
      const completedVideos: Map<number, string> = new Map(); // index -> videoUrl
      let nextChunkToStart = 0;
      let nextChunkToPlay = 0;

      while (nextChunkToPlay < chunks.length) {
        // Start new chunks if we have capacity
        while (
          nextChunkToStart < chunks.length && 
          activeJobs.size < MAX_CONCURRENT_CHUNKS
        ) {
          const chunk = chunks[nextChunkToStart];
          const result = await generateChunk(chunk, imageUrl, figureId, figureName);
          
          if (result) {
            // Check if it's an immediate video URL (starts with http)
            if (result.jobId.startsWith('http')) {
              completedVideos.set(result.index, result.jobId);
            } else {
              activeJobs.set(result.index, result.jobId);
            }
            
            setState(prev => ({
              ...prev,
              pendingChunks: prev.pendingChunks.map(c => 
                c.index === chunk.index ? { ...c, status: 'generating', jobId: result.jobId } : c
              )
            }));
          }
          
          nextChunkToStart++;
        }

        // Check if next chunk to play is ready
        if (completedVideos.has(nextChunkToPlay)) {
          const videoUrl = completedVideos.get(nextChunkToPlay)!;
          console.log(`▶️ Playing chunk ${nextChunkToPlay}`);
          
          setState(prev => ({
            ...prev,
            currentChunkIndex: nextChunkToPlay,
            currentVideoUrl: videoUrl,
            completedChunks: [...prev.completedChunks, { 
              index: nextChunkToPlay, 
              status: 'completed', 
              videoUrl 
            }],
          }));

          onVideoReady(videoUrl);
          nextChunkToPlay++;
          continue;
        }

        // Poll active jobs
        for (const [index, jobId] of activeJobs) {
          const videoUrl = await pollChunkCompletion(jobId, index, 1); // Single poll
          
          if (videoUrl) {
            completedVideos.set(index, videoUrl);
            activeJobs.delete(index);
            
            setState(prev => ({
              ...prev,
              pendingChunks: prev.pendingChunks.map(c =>
                c.index === index ? { ...c, status: 'completed', videoUrl } : c
              )
            }));
          }
        }

        // Small delay before next iteration
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // All chunks complete
      setState(prev => ({ ...prev, isGenerating: false }));
      onAllComplete();
    };

    processChunks().catch(err => {
      console.error('❌ Chunked video generation error:', err);
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        error: err.message 
      }));
    });
  }, [generateChunk, pollChunkCompletion]);

  // Signal that current video finished playing - advance to next in queue
  const onVideoEnded = useCallback(() => {
    if (videoQueueRef.current.length > 0) {
      const nextUrl = videoQueueRef.current.shift()!;
      setState(prev => ({ ...prev, currentVideoUrl: nextUrl }));
      onVideoReadyRef.current?.(nextUrl);
    } else {
      isPlayingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    videoQueueRef.current = [];
    isPlayingRef.current = false;
    setState({
      isGenerating: false,
      currentChunkIndex: 0,
      totalChunks: 0,
      completedChunks: [],
      pendingChunks: [],
      currentVideoUrl: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    generateChunkedVideo,
    onVideoEnded,
    reset,
  };
}
