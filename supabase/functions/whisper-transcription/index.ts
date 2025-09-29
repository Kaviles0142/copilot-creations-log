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
    const { audioUrl, language = 'en' } = await req.json();

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found');
    }

    console.log(`🎤 Starting Whisper transcription for audio: ${audioUrl}`);

    // Download the audio file
    console.log('📥 Downloading audio file...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0');

    console.log('🧠 Sending to OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API failed: ${whisperResponse.statusText}`);
    }

    const result = await whisperResponse.json();

    console.log('✅ Transcription completed successfully');

    // Calculate confidence score from segments
    const avgConfidence = result.segments 
      ? result.segments.reduce((acc: number, segment: any) => acc + (segment.avg_logprob || 0), 0) / result.segments.length
      : 0;

    const confidence = Math.max(0, Math.min(1, (avgConfidence + 5) / 5)); // Normalize to 0-1

    return new Response(JSON.stringify({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.duration,
      confidence: confidence,
      segments: result.segments?.length || 0,
      words: result.words?.length || 0,
      processing_time: Date.now()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Whisper transcription error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
      text: '',
      confidence: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});