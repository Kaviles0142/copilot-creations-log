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

    // Download audio from YouTube using yt-dlp
    console.log(`Downloading audio for ${videoId}...`);
    const ytDlpProcess = new Deno.Command("yt-dlp", {
      args: [
        "-f", "bestaudio",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "-o", "-",
        `https://www.youtube.com/watch?v=${videoId}`
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const ytDlpOutput = await ytDlpProcess.output();
    
    if (!ytDlpOutput.success) {
      const errorText = new TextDecoder().decode(ytDlpOutput.stderr);
      console.error('yt-dlp error:', errorText);
      throw new Error(`Failed to download audio: ${errorText}`);
    }

    const audioData = ytDlpOutput.stdout;
    console.log(`Downloaded ${audioData.length} bytes of audio`);

    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    // Send to OpenAI Whisper
    console.log('Sending to OpenAI Whisper...');
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI transcription failed: ${errorText}`);
    }

    const transcript = await openaiResponse.text();
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
