// Utility to chunk base64 audio into segments for parallel video generation

export interface AudioChunk {
  index: number;
  dataUrl: string;
  estimatedDurationSec: number;
}

const MAX_CHUNK_DURATION_SEC = 30;
const BYTES_PER_SECOND = 2000; // Approximate for MP3 at 16kbps

/**
 * Estimates the duration of a base64 audio data URL
 */
export function estimateAudioDuration(audioDataUrl: string): number {
  if (!audioDataUrl?.startsWith('data:')) return 10;
  const base64Part = audioDataUrl.split(',')[1] || '';
  const estimatedBytes = base64Part.length * 0.75;
  return Math.max(1, estimatedBytes / BYTES_PER_SECOND);
}

/**
 * Checks if audio should be chunked (longer than MAX_CHUNK_DURATION_SEC)
 */
export function shouldChunkAudio(audioDataUrl: string): boolean {
  const duration = estimateAudioDuration(audioDataUrl);
  return duration > MAX_CHUNK_DURATION_SEC;
}

/**
 * Splits base64 audio into approximately equal chunks.
 * Note: This is a simple byte-based split - for production, 
 * you'd want to use proper audio processing to split at silent points.
 */
export function chunkAudioData(audioDataUrl: string): AudioChunk[] {
  if (!audioDataUrl?.startsWith('data:')) {
    return [{ index: 0, dataUrl: audioDataUrl, estimatedDurationSec: 10 }];
  }

  const [header, base64Data] = audioDataUrl.split(',');
  if (!base64Data) {
    return [{ index: 0, dataUrl: audioDataUrl, estimatedDurationSec: 10 }];
  }

  const totalBytes = base64Data.length * 0.75;
  const totalDuration = totalBytes / BYTES_PER_SECOND;
  
  // If short enough, return as single chunk
  if (totalDuration <= MAX_CHUNK_DURATION_SEC) {
    return [{ index: 0, dataUrl: audioDataUrl, estimatedDurationSec: totalDuration }];
  }

  // Calculate number of chunks
  const numChunks = Math.ceil(totalDuration / MAX_CHUNK_DURATION_SEC);
  const charsPerChunk = Math.ceil(base64Data.length / numChunks);
  
  // Make sure chunk size is divisible by 4 for valid base64
  const adjustedCharsPerChunk = Math.ceil(charsPerChunk / 4) * 4;
  
  const chunks: AudioChunk[] = [];
  let offset = 0;
  let index = 0;

  while (offset < base64Data.length) {
    const chunkBase64 = base64Data.slice(offset, offset + adjustedCharsPerChunk);
    const chunkBytes = chunkBase64.length * 0.75;
    const chunkDuration = chunkBytes / BYTES_PER_SECOND;
    
    chunks.push({
      index,
      dataUrl: `${header},${chunkBase64}`,
      estimatedDurationSec: chunkDuration,
    });
    
    offset += adjustedCharsPerChunk;
    index++;
  }

  console.log(`🎵 Split audio into ${chunks.length} chunks of ~${MAX_CHUNK_DURATION_SEC}s each`);
  return chunks;
}

/**
 * Returns chunk configuration for parallel video generation
 */
export function getChunkConfig(audioDataUrl: string): {
  shouldChunk: boolean;
  chunks: AudioChunk[];
  totalDuration: number;
} {
  const totalDuration = estimateAudioDuration(audioDataUrl);
  const shouldChunk = totalDuration > MAX_CHUNK_DURATION_SEC;
  const chunks = shouldChunk ? chunkAudioData(audioDataUrl) : [{ 
    index: 0, 
    dataUrl: audioDataUrl, 
    estimatedDurationSec: totalDuration 
  }];
  
  return { shouldChunk, chunks, totalDuration };
}
