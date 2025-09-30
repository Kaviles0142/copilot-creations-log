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
    const { text, voice } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    console.log(`Generating speech with Coqui XTTS for voice: ${voice}`);

    let audioContent: string;
    let fallback = false;

    if (voice && voice.startsWith('coqui_')) {
      console.log(`Using real Coqui XTTS for voice: ${voice} with text: "${text.slice(0, 50)}..."`);
      
      try {
        audioContent = await generateCoquiXTTS(text, voice);
        console.log('Successfully generated audio with Coqui XTTS');
      } catch (error) {
        console.error('Coqui XTTS error:', error);
        console.log('Falling back to ElevenLabs');
        audioContent = await generateElevenLabsFallback(text);
        fallback = true;
      }
    } else {
      // Use ElevenLabs as fallback for non-Coqui voices
      console.log('Using ElevenLabs fallback for voice:', voice);
      audioContent = await generateElevenLabsFallback(text);
      fallback = true;
    }

    return new Response(JSON.stringify({ 
      audioContent,
      fallback,
      provider: fallback ? 'elevenlabs' : 'coqui',
      voiceId: voice
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in coqui-text-to-speech:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate speech using real Coqui XTTS
async function generateCoquiXTTS(text: string, voiceId: string): Promise<string> {
  console.log(`Generating real Coqui XTTS speech for ${voiceId}`);
  
  // Extract figure name from voice ID
  const figureName = voiceId.replace('coqui_', '').replace('_premium_fallback', '').replace(/_/g, ' ');
  
  try {
    // Use the free Coqui TTS service (coquitts.com provides free API access)
    const response = await fetch('https://api.coquitts.com/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        speaker: 'default', // We'll use default speaker for now
        language: 'en',
        speed: 1.0,
        model: 'xtts-v2',
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.9,
          emotion: 'neutral'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Coqui TTS API error:', response.status, errorText);
      throw new Error(`Coqui TTS API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.audio_url) {
      throw new Error('No audio URL returned from Coqui TTS');
    }

    // Download the generated audio
    const audioResponse = await fetch(result.audio_url);
    if (!audioResponse.ok) {
      throw new Error('Failed to download generated audio');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    console.log(`Generated real Coqui XTTS audio of ${audioBuffer.byteLength} bytes for ${figureName}`);
    
    return base64Audio;
    
  } catch (error) {
    console.error('Coqui XTTS generation failed:', error);
    
    // If the free service fails, try using a local XTTS implementation
    // This would require deploying XTTS-v2 model but for now we'll throw
    throw new Error(`Coqui XTTS unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fallback to ElevenLabs with default voice
async function generateElevenLabsFallback(text: string): Promise<string> {
  console.log('Generating fallback speech with ElevenLabs');
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.8,
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs fallback API error:', response.status, errorText);
    throw new Error(`ElevenLabs fallback API error: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
  
  console.log(`Generated fallback audio of ${audioBuffer.byteLength} bytes`);
  
  return base64Audio;
}