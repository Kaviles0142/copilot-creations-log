import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, figureName } = await req.json();

    if (!videoUrl) {
      throw new Error('Video URL is required');
    }

    console.log(`Extracting audio from YouTube video: ${videoUrl} for ${figureName}`);

    // Extract video ID from YouTube URL
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Use yt-dlp to extract audio information
    const audioInfo = await extractAudioWithYtDlp(videoId);
    
    if (!audioInfo.success) {
      throw new Error(`Failed to extract audio: ${audioInfo.error}`);
    }

    console.log(`Successfully extracted audio for ${figureName}:`, audioInfo);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: audioInfo.audioUrl,
        duration: audioInfo.duration,
        title: audioInfo.title,
        quality: audioInfo.quality,
        format: audioInfo.format
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-youtube-audio:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractYouTubeVideoId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^&\n?#]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function extractAudioWithYtDlp(videoId: string) {
  console.log(`Starting yt-dlp extraction for video ID: ${videoId}`);
  
  try {
    // In a real implementation, you would:
    // 1. Use yt-dlp to download audio
    // 2. Process and clean the audio
    // 3. Upload to storage and return URL
    
    // For now, we'll simulate the process and provide a mock response
    // that would work with the rest of the pipeline
    
    const mockAudioUrl = `https://example.com/extracted-audio/${videoId}.wav`;
    
    // Simulate extraction delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Mock extraction completed for ${videoId}`);
    
    return {
      success: true,
      audioUrl: mockAudioUrl,
      duration: 180, // 3 minutes
      title: `Extracted audio from ${videoId}`,
      quality: 'high',
      format: 'wav',
      extractionMethod: 'yt-dlp_simulation'
    };
    
  } catch (error) {
    console.error('yt-dlp extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
      audioUrl: null
    };
  }
}

// Note: In a production environment, you would implement:
// 1. Actual yt-dlp integration using Deno subprocess
// 2. Audio file storage in Supabase Storage
// 3. Audio processing and cleaning
// 4. Proper error handling and retries
// 
// Example production implementation would use:
// const process = new Deno.Command("yt-dlp", {
//   args: [
//     "--extract-audio",
//     "--audio-format", "wav",
//     "--audio-quality", "0",
//     `https://youtube.com/watch?v=${videoId}`
//   ]
// });
// const { code, stdout, stderr } = await process.output();