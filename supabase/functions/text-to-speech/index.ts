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
    const { text, voice = "Brian" } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
    }

    // Map voice names to ElevenLabs voice IDs with premium natural voices
    const voiceMap: Record<string, string> = {
      'Brian': 'nPczCjzI2devNBz1zQrb',      // Deep, natural male voice
      'Daniel': 'onwK4e9ZLuTAKqWW03F9',     // Mature, thoughtful male voice  
      'George': 'JBFqnCBsd6RMkjVDRZzb',     // Authoritative male voice
      'Eric': 'cjVigY5qzO86Huf0OWal',       // Warm male voice
      'Liam': 'TX3LPaxmHKxFdv7VOQHJ',       // Young male voice
      'Will': 'bIHbv24MWmeRgasZH58o',       // Confident male voice
      'Callum': 'N2lVS1w4EtoT3dr4eOWO',     // British male voice
      'Roger': 'CwhRBWXzGAHq8TQ4Fs17',      // Professional male voice
      'Sarah': 'EXAVITQu4vr4xnSDxMaL',      // Professional female voice
      'Laura': 'FGY2WhTYpPnrIDTdsKH5',      // Warm female voice
      'Charlotte': 'XB0fDUnXU5powFXDhCwa',   // Clear female voice
      'Alice': 'Xb7hH8MSUJpSbSDYk0k2',      // Young female voice
      'Jessica': 'cgSgspJ2msm6clMCkdW9',     // Friendly female voice
      'Aria': '9BWtsMINqrJLrRacOk9x',        // Default female voice
    };

    const voiceId = voiceMap[voice] || voiceMap['Brian'];

    console.log(`Generating natural ElevenLabs speech for: "${text.substring(0, 50)}..." with voice: ${voice} (${voiceId})`);

    // Call ElevenLabs TTS API for ultra-natural speech
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2", // Premium model for most natural speech
        voice_settings: {
          stability: 0.75,        // Higher stability for consistent voice
          similarity_boost: 0.8,  // Higher similarity for more natural sound
          style: 0.2,            // Slight style for personality
          use_speaker_boost: true // Enhanced voice clarity
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    // Convert audio buffer to base64 (handle large files properly)
    const audioBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert in chunks to avoid call stack overflow
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binary);

    console.log(`Successfully generated natural audio of ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});