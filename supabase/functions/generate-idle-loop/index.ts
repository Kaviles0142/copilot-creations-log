import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate 3 seconds of near-silence audio as Float32 PCM 16kHz
function generateSilentAudioPCM(durationSeconds: number = 3): Float32Array {
  const sampleRate = 16000;
  const numSamples = sampleRate * durationSeconds;
  const audioData = new Float32Array(numSamples);
  
  // Add very subtle ambient noise to create gentle "breathing" motion
  for (let i = 0; i < numSamples; i++) {
    // Ultra-low amplitude ambient noise (almost silent)
    const noise = (Math.random() * 2 - 1) * 0.001;
    // Very slow breathing rhythm (approx 12 breaths per minute = 0.2 Hz)
    const breathing = Math.sin(i / sampleRate * Math.PI * 0.4) * 0.002;
    audioData[i] = noise + breathing;
  }
  
  return audioData;
}

function float32ToBase64(float32Array: Float32Array): string {
  const bytes = new Uint8Array(float32Array.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, figureId, figureName } = await req.json();

    if (!imageBase64) {
      throw new Error('imageBase64 is required');
    }

    const DITTO_API_URL = Deno.env.get('DITTO_API_URL');
    if (!DITTO_API_URL) {
      throw new Error('DITTO_API_URL not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if we have a cached idle video for this figure
    const cacheKey = `idle-${figureId || 'unknown'}`;
    
    // Check audio-files bucket for cached idle video
    const { data: existingFiles } = await supabase.storage
      .from('audio-files')
      .list('idle-videos', {
        search: `${cacheKey}.mp4`
      });

    if (existingFiles && existingFiles.length > 0) {
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(`idle-videos/${cacheKey}.mp4`);
      
      console.log(`✅ Using cached idle video for ${figureName || figureId}`);
      return new Response(JSON.stringify({ 
        videoUrl: urlData.publicUrl,
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎬 Generating idle loop video for ${figureName || figureId}...`);

    // Generate 3 seconds of near-silent audio
    const silentAudioPCM = generateSilentAudioPCM(3);
    
    // Connect to Ditto WebSocket and generate video
    const wsUrl = DITTO_API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/stream';
    
    // We need to use HTTP endpoint for video generation since we need MP4 output
    // Use the /generate endpoint instead of WebSocket for file output
    const generateUrl = `${DITTO_API_URL}/generate`;
    
    console.log(`📡 Sending request to Ditto: ${generateUrl}`);

    const audioBase64 = float32ToBase64(silentAudioPCM);

    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_b64: imageBase64,
        audio_b64: audioBase64,
        sample_rate: 16000,
        output_format: 'mp4',
        fps: 25,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ditto API error:', errorText);
      throw new Error(`Ditto API failed: ${response.status} - ${errorText}`);
    }

    // Get the video as blob
    const videoBlob = await response.blob();
    const videoBuffer = await videoBlob.arrayBuffer();

    console.log(`✅ Received idle video: ${videoBuffer.byteLength} bytes`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(`idle-videos/${cacheKey}.mp4`, new Uint8Array(videoBuffer), {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw new Error(`Failed to upload video: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(`idle-videos/${cacheKey}.mp4`);

    console.log(`✅ Idle video uploaded and cached: ${urlData.publicUrl}`);

    return new Response(JSON.stringify({ 
      videoUrl: urlData.publicUrl,
      cached: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
