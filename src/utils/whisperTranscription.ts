import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true; // Cache models for faster subsequent loads

let whisperPipeline: any = null;

export const initializeWhisper = async (onProgress?: (progress: number) => void) => {
  if (whisperPipeline) return whisperPipeline;
  
  console.log('Initializing Whisper model...');
  
  whisperPipeline = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en', // Small model, fast for English
    { 
      device: 'webgpu',
      progress_callback: (progress: any) => {
        if (onProgress && progress.progress !== undefined) {
          onProgress(progress.progress);
        }
      }
    }
  );
  
  console.log('Whisper model loaded');
  return whisperPipeline;
};

export const transcribeAudioBlob = async (
  audioBlob: Blob,
  onProgress?: (stage: string, progress?: number) => void
): Promise<string> => {
  try {
    onProgress?.('Initializing Whisper model...', 0);
    
    // Initialize Whisper model
    const transcriber = await initializeWhisper((progress) => {
      onProgress?.('Loading model...', progress * 50);
    });
    
    onProgress?.('Converting audio...', 50);
    
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    onProgress?.('Transcribing...', 60);
    
    // Transcribe
    const result = await transcriber(arrayBuffer);
    
    onProgress?.('Complete', 100);
    
    if (!result || !result.text) {
      throw new Error('No transcription result');
    }
    
    return result.text;
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
};

export const transcribeAudioUrl = async (
  audioUrl: string,
  onProgress?: (stage: string, progress?: number) => void
): Promise<string> => {
  try {
    onProgress?.('Downloading audio...', 0);
    
    // Fetch audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    onProgress?.('Audio downloaded', 20);
    
    // Transcribe
    return await transcribeAudioBlob(blob, (stage, progress) => {
      // Scale progress from 20-100
      const scaledProgress = progress ? 20 + (progress * 0.8) : undefined;
      onProgress?.(stage, scaledProgress);
    });
  } catch (error) {
    console.error('Audio URL transcription error:', error);
    throw error;
  }
};
