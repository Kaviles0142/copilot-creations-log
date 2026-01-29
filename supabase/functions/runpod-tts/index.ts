import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNPOD_TTS_ENDPOINT = 'https://api.runpod.ai/v2/p6140hhomrk60a';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNPOD_API_KEY = Deno.env.get('RUNPOD_API_KEY');
    if (!RUNPOD_API_KEY) {
      throw new Error('RUNPOD_API_KEY not configured');
    }

    const { text, voice = 'male', exaggeration = 0.45, cfg_weight = 0.55, temperature = 0.65, voiceReferenceUrl } = await req.json();

    if (!text) {
      throw new Error('text is required');
    }

    console.log('🎤 Starting TTS generation for:', text.substring(0, 50) + '...');

    // Submit job to RunPod
    const runResponse = await fetch(`${RUNPOD_TTS_ENDPOINT}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          text,
          characterName: 'default',
          voice,
          exaggeration,
          cfg_weight,
          temperature,
          ...(voiceReferenceUrl && { voiceReferenceUrl }),
        }
      })
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('❌ RunPod run error:', errorText);
      throw new Error(`RunPod run failed: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const jobId = runData.id;
    console.log('📋 Job submitted:', jobId);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    let result = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${RUNPOD_TTS_ENDPOINT}/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log(`⏳ Status (${attempts}):`, statusData.status);

      if (statusData.status === 'COMPLETED') {
        result = statusData;
        break;
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Job failed: ${JSON.stringify(statusData.error || statusData)}`);
      }

      attempts++;
    }

    if (!result) {
      throw new Error('Job timed out after 60 seconds');
    }

    // Extract audio from various response formats
    let audioBase64 = null;
    let audioUrl = null;

    const output = result.output || result;
    
    if (typeof output.audio === 'string') {
      audioBase64 = output.audio;
    } else if (output.audio?.audio_base64) {
      audioBase64 = output.audio.audio_base64;
    } else if (output.audio?.url) {
      audioUrl = output.audio.url;
    } else if (output.audio_base64) {
      audioBase64 = output.audio_base64;
    } else if (output.url) {
      audioUrl = output.url;
    }

    // If we got a URL, fetch the audio
    if (audioUrl && !audioBase64) {
      console.log('📥 Fetching audio from URL:', audioUrl);
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    }

    if (!audioBase64) {
      console.error('❌ Could not extract audio from response:', JSON.stringify(result));
      throw new Error('Could not extract audio from response');
    }

    console.log('✅ TTS audio generated, length:', audioBase64.length);

    return new Response(JSON.stringify({
      audio_base64: audioBase64,
      job_id: jobId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in runpod-tts:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
