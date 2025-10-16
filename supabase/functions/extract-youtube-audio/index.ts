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

    // Extract direct audio stream URL from YouTube
    const audioInfo = await extractAudioWithYtDlp(videoId);
    
    if (!audioInfo.success) {
      throw new Error(`Failed to extract audio: ${audioInfo.error}`);
    }

    console.log(`Successfully extracted audio stream for ${figureName}`);
    console.log(`Duration: ${audioInfo.duration}s, Format: ${audioInfo.format}`);

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
  console.log(`Extracting audio URL for video ID: ${videoId}`);
  
  try {
    // Use YouTube's oEmbed API for video metadata (more reliable)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const metadataResponse = await fetch(oembedUrl);
    
    let title = 'Unknown';
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      title = metadata.title || 'Unknown';
      console.log(`Video title: ${title}`);
    }

    // Fetch YouTube page with updated patterns
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`);
    }

    const html = await response.text();
    
    // Try multiple extraction patterns (YouTube changes these frequently)
    let playerResponse = null;
    
    // Pattern 1: var ytInitialPlayerResponse
    const pattern1 = /var ytInitialPlayerResponse\s*=\s*({.+?});/;
    const match1 = html.match(pattern1);
    if (match1) {
      try {
        playerResponse = JSON.parse(match1[1]);
        console.log('Extracted using pattern 1: var ytInitialPlayerResponse');
      } catch (e) {
        console.log('Pattern 1 failed to parse JSON');
      }
    }
    
    // Pattern 2: ytInitialPlayerResponse in script tag
    if (!playerResponse) {
      const pattern2 = /ytInitialPlayerResponse\s*=\s*({.+?});var/;
      const match2 = html.match(pattern2);
      if (match2) {
        try {
          playerResponse = JSON.parse(match2[1]);
          console.log('Extracted using pattern 2: ytInitialPlayerResponse in script');
        } catch (e) {
          console.log('Pattern 2 failed to parse JSON');
        }
      }
    }
    
    // Pattern 3: window["ytInitialPlayerResponse"]
    if (!playerResponse) {
      const pattern3 = /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/;
      const match3 = html.match(pattern3);
      if (match3) {
        try {
          playerResponse = JSON.parse(match3[1]);
          console.log('Extracted using pattern 3: window["ytInitialPlayerResponse"]');
        } catch (e) {
          console.log('Pattern 3 failed to parse JSON');
        }
      }
    }

    if (!playerResponse) {
      throw new Error('Could not extract player response with any pattern. YouTube may have changed their page structure.');
    }

    const streamingData = playerResponse.streamingData;
    
    if (!streamingData?.adaptiveFormats && !streamingData?.formats) {
      throw new Error('No streaming data available in player response');
    }

    // Try adaptive formats first (better quality)
    let audioFormats = [];
    if (streamingData.adaptiveFormats) {
      audioFormats = streamingData.adaptiveFormats
        .filter((format: any) => format.mimeType?.includes('audio'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    }
    
    // Fallback to combined formats if no audio-only streams
    if (audioFormats.length === 0 && streamingData.formats) {
      console.log('No audio-only streams, using combined formats');
      audioFormats = streamingData.formats
        .filter((format: any) => format.mimeType?.includes('audio') || format.audioQuality)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    }

    if (audioFormats.length === 0) {
      throw new Error('No audio streams found in any format');
    }

    const bestAudio = audioFormats[0];
    const audioUrl = bestAudio.url;
    
    if (!audioUrl) {
      throw new Error('No audio URL found in best format');
    }

    console.log(`Successfully extracted audio URL for ${videoId}`);
    console.log(`Audio format: ${bestAudio.mimeType}, bitrate: ${bestAudio.bitrate}`);
    
    return {
      success: true,
      audioUrl: audioUrl,
      duration: parseInt(playerResponse.videoDetails?.lengthSeconds || '0'),
      title: playerResponse.videoDetails?.title || title,
      quality: 'highest',
      format: bestAudio.mimeType,
      extractionMethod: 'direct_stream_url'
    };
    
  } catch (error) {
    console.error('Audio extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
      audioUrl: null
    };
  }
}