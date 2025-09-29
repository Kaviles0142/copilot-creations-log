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
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;
    const description = formData.get('description') as string;

    if (!audioFile || !voiceName) {
      throw new Error('Audio file and voice name are required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
    }

    console.log(`Creating voice clone for: ${voiceName}`);
    console.log(`Audio file size: ${audioFile.size} bytes`);

    // Create FormData for ElevenLabs API
    const cloneFormData = new FormData();
    cloneFormData.append('name', voiceName);
    cloneFormData.append('description', description || `Historical voice clone of ${voiceName}`);
    cloneFormData.append('files', audioFile);

    // Call ElevenLabs voice cloning API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: cloneFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs voice cloning error:', errorText);
      throw new Error(`Voice cloning failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Voice clone created successfully:', result);

    // Store the cloned voice information in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const voiceData = {
      voice_id: result.voice_id,
      voice_name: voiceName,
      description: description || `Historical voice clone of ${voiceName}`,
      is_cloned: true,
      created_at: new Date().toISOString()
    };

    const storeResponse = await fetch(
      `${supabaseUrl}/rest/v1/historical_voices`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(voiceData)
      }
    );

    if (!storeResponse.ok) {
      console.error('Failed to store voice data in database');
      // Continue anyway since the clone was successful
    }

    return new Response(JSON.stringify({
      success: true,
      voice_id: result.voice_id,
      voice_name: voiceName,
      message: `Successfully cloned voice for ${voiceName}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Voice cloning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Voice cloning failed';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});