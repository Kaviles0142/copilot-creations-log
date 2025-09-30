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

  let requestData: any;
  try {
    requestData = await req.json();
    const { text, voice = "default" } = requestData;

    if (!text) {
      throw new Error('Text is required');
    }

    const RESEMBLE_API_KEY = Deno.env.get('RESEMBLE_AI_API_KEY');
    if (!RESEMBLE_API_KEY) {
      throw new Error('Resemble AI API key not found');
    }

    console.log(`Generating speech with Resemble.ai for voice: ${voice}`);

    // Parse voice ID - could be a Resemble voice ID or fallback
    let voiceId = voice;
    if (voice.includes('-cloned-') || voice.startsWith('resemble_')) {
      // Extract the actual voice ID from our naming convention
      const match = voice.match(/resemble_(.+)_\d+/) || voice.match(/cloned_(.+)_\d+/);
      if (match) {
        voiceId = match[1];
      }
    }

    console.log(`Using Resemble.ai voice ID: ${voiceId} for text: "${text.substring(0, 50)}..."`);

    // Call Resemble.ai TTS API - using proper project setup
    const projectId = Deno.env.get('RESEMBLE_PROJECT_ID') || 'default';
    const apiUrl = `https://app.resemble.ai/api/v2/projects/${projectId}/clips`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEMBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: text,
        voice_uuid: voiceId,
        precision: 'PCM_22050',
        output_format: 'mp3',
        is_public: false,
        is_archived: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resemble.ai API error:', response.status, errorText);
      
      // Check if this is an HTML error page (common issue we've seen)
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        console.error('Received HTML error page from Resemble.ai - API may be down');
        throw new Error('Resemble.ai service unavailable - received HTML error page');
      }
      
      throw new Error(`Resemble.ai API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Resemble.ai returns a URL to the generated audio
    if (result.audio_url) {
      // Download the audio and convert to base64
      const audioResponse = await fetch(result.audio_url);
      if (!audioResponse.ok) {
        throw new Error('Failed to download generated audio');
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const uint8Array = new Uint8Array(audioBuffer);
      
      // Convert to base64 in chunks
      let binary = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binary);

      console.log(`Successfully generated Resemble.ai audio of ${audioBuffer.byteLength} bytes`);

      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      throw new Error('No audio URL returned from Resemble.ai');
    }

  } catch (error) {
    console.error('Error in resemble-text-to-speech:', error);
    
    // Try fallback speech generation with ElevenLabs
    try {
      return await generateFallbackSpeech(
        requestData?.text || 'Error occurred',
        requestData?.voice || 'default'
      );
    } catch (fallbackError) {
      console.error('Fallback speech generation failed:', fallbackError);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }
});

async function generateFallbackSpeech(text: string, voice: string) {
  console.log('Fallback: Generating speech using ElevenLabs API');
  
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not found for fallback');
  }

  // Use a default ElevenLabs voice for fallback
  const fallbackVoiceId = 'onwK4e9ZLuTAKqWW03F9'; // Daniel voice
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(audioBuffer);
  
  // Convert to base64
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  const base64Audio = btoa(binary);
  
  console.log(`Generated ElevenLabs fallback audio of ${audioBuffer.byteLength} bytes`);
  
  return new Response(
    JSON.stringify({ 
      audioContent: base64Audio,
      fallback: true,
      message: 'Generated using ElevenLabs fallback'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}