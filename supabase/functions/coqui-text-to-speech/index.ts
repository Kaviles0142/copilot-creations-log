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

    // Since Coqui API is unavailable, use ElevenLabs for all voice generation
    console.log(`Generating speech with ElevenLabs for voice: ${voice || 'default'}`);
    audioContent = await generateElevenLabsFallback(text);
    fallback = true;

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

// Generate speech using REAL Coqui XTTS voice cloning
async function generateCoquiXTTS(text: string, voiceId: string): Promise<string> {
  console.log(`🎯 Generating REAL Coqui XTTS speech for voice: ${voiceId}`);
  
  // Extract figure name from voice ID
  const figureName = voiceId.replace('coqui_', '').replace('_premium_fallback', '').replace(/_/g, ' ');
  
  try {
    const coquiApiKey = Deno.env.get('COQUI_API_KEY');
    if (!coquiApiKey) {
      console.log('No Coqui API key found, using simulated cloned voice with ElevenLabs');
      // Skip the Coqui API call and go directly to the simulated voice
    } else {
      console.log('Using REAL Coqui XTTS API');
      
      try {
        const response = await fetch('https://api.coqui.ai/tts/v1/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${coquiApiKey}`,
          },
          body: JSON.stringify({
            text: text,
            voice_id: voiceId,
            model_id: 'XTTS-v2',
            language: 'en',
            speed: 1.0,
            emotion: 'neutral',
            output_format: 'mp3'
          }),
        });

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          console.log(`✅ Generated REAL Coqui XTTS audio for ${figureName}`);
          return base64Audio;
        } else {
          console.warn('Coqui API failed, falling back to simulated cloned voice');
        }
      } catch (error) {
        console.warn('Coqui API error:', error, 'falling back to simulated cloned voice');
      }
    }
    
    // For demonstration: Use a high-quality voice that represents the cloned voice
    // This simulates what the actual Coqui cloned voice would sound like
    console.log(`🎭 Using simulated cloned voice for ${figureName} (represents actual voice clone)`);
    
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Use the BEST available voice for each historical figure to simulate their cloned voice
    const simulatedClonedVoices: Record<string, string> = {
      'coqui_john_f_kennedy_premium_fallback': 'onwK4e9ZLuTAKqWW03F9', // Daniel - represents JFK clone
      'coqui_winston_churchill_premium_fallback': 'JBFqnCBsd6RMkjVDRZzb', // George - represents Churchill clone
      'coqui_martin_luther_king_jr_premium_fallback': 'TX3LPaxmHKxFdv7VOQHJ', // Liam - represents MLK clone
      'coqui_franklin_d_roosevelt_premium_fallback': 'bIHbv24MWmeRgasZH58o', // Will - represents FDR clone
    };

    const simulatedVoiceId = simulatedClonedVoices[voiceId] || 'onwK4e9ZLuTAKqWW03F9';

    console.log(`🎭 Using voice ${simulatedVoiceId} to simulate cloned voice of ${figureName}`);

    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + simulatedVoiceId, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5', // Fast model for quick response
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.5,
          use_speaker_boost: false
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Simulated cloned voice API error:', response.status, errorText);
      throw new Error(`Simulated cloned voice API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    console.log(`✅ Generated simulated cloned voice audio for ${figureName} (${audioBuffer.byteLength} bytes)`);
    
    return base64Audio;
    
  } catch (error) {
    console.error('Error generating Coqui XTTS speech:', error);
    throw error;
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