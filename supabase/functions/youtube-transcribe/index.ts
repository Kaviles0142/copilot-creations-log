import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, videoTitle, figureId, figureName } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    console.log(`Starting transcription for video: ${videoId}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have this transcript
    const { data: existing } = await supabase
      .from('youtube_transcripts')
      .select('*')
      .eq('video_id', videoId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing) {
      console.log(`Using cached transcript for ${videoId}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          cached: true,
          transcript: existing.transcript,
          videoId: existing.video_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch video page to extract transcript data
    console.log(`Fetching YouTube page for ${videoId}...`);
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const html = await pageResponse.text();

    // Extract captions/transcript URL from page
    const captionTrackMatch = html.match(/"captions".*?"captionTracks":(\[.*?\])/);
    
    if (!captionTrackMatch) {
      console.log(`No captions found for video ${videoId}, falling back to Whisper transcription...`);
      
      // Fallback: Extract audio and use Whisper
      try {
        const { data: audioData, error: audioError } = await supabase.functions.invoke(
          'extract-youtube-audio',
          { body: { videoId } }
        );

        if (audioError || !audioData?.audioUrl) {
          throw new Error('Failed to extract audio from video');
        }

        console.log(`Audio extracted, transcribing with Whisper...`);

        const { data: whisperData, error: whisperError } = await supabase.functions.invoke(
          'whisper-transcription',
          { body: { audioUrl: audioData.audioUrl } }
        );

        if (whisperError || !whisperData?.transcript) {
          throw new Error('Whisper transcription failed');
        }

        const transcript = whisperData.transcript;
        console.log(`Whisper transcription complete: ${transcript.length} characters`);

        // Save to database
        const { error: saveError } = await supabase
          .from('youtube_transcripts')
          .upsert({
            video_id: videoId,
            figure_id: figureId,
            figure_name: figureName,
            video_title: videoTitle,
            transcript: transcript,
          });

        if (saveError) {
          console.error('Error saving transcript:', saveError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            cached: false,
            transcript,
            videoId,
            method: 'whisper'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (whisperErr) {
        console.error('Whisper fallback failed:', whisperErr);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'No captions available and Whisper transcription failed',
            videoId
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    const captionTracks = JSON.parse(captionTrackMatch[1]);
    
    // Prefer English captions
    let captionTrack = captionTracks.find((track: any) => 
      track.languageCode === 'en' || track.languageCode === 'en-US'
    );
    
    // Fallback to first available
    if (!captionTrack && captionTracks.length > 0) {
      captionTrack = captionTracks[0];
    }

    if (!captionTrack) {
      throw new Error('No caption track found');
    }

    // Fetch the caption data
    console.log(`Fetching caption track...`);
    const captionResponse = await fetch(captionTrack.baseUrl);
    
    if (!captionResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
    }

    const captionXml = await captionResponse.text();

    // Parse XML and extract text
    const textMatches = captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
    let transcript = '';
    
    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();
      
      if (text) {
        transcript += text + ' ';
      }
    }

    transcript = transcript.trim();
    
    if (!transcript) {
      throw new Error('Failed to extract transcript text');
    }

    console.log(`Transcription complete: ${transcript.length} characters`);

    // Save to database
    const { error: saveError } = await supabase
      .from('youtube_transcripts')
      .upsert({
        video_id: videoId,
        figure_id: figureId,
        figure_name: figureName,
        video_title: videoTitle,
        transcript: transcript,
      });

    if (saveError) {
      console.error('Error saving transcript:', saveError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cached: false,
        transcript,
        videoId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in youtube-transcribe:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
