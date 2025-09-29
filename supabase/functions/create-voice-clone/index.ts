import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, voiceName, description } = await req.json();

    if (!audioUrl || !voiceName) {
      throw new Error('Audio URL and voice name are required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
    }

    console.log(`Creating voice clone: ${voiceName} from ${audioUrl}`);

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Create form data for voice cloning
    const formData = new FormData();
    formData.append('name', voiceName);
    formData.append('description', description || `Cloned voice of ${voiceName}`);
    
    // Convert audio buffer to blob and append to form
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('files', audioBlob, 'sample.mp3');

    // Call ElevenLabs voice cloning API
    const cloneResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!cloneResponse.ok) {
      const errorText = await cloneResponse.text();
      console.error('ElevenLabs voice cloning error:', errorText);
      throw new Error(`Voice cloning failed: ${cloneResponse.status} ${errorText}`);
    }

    const cloneData = await cloneResponse.json();
    console.log(`Voice clone created successfully: ${cloneData.voice_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        voiceId: cloneData.voice_id,
        voiceName: voiceName,
        message: `Successfully cloned voice for ${voiceName}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error creating voice clone:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});