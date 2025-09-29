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
    const { text, voice = "Einstein" } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
    }

    // Map voice names to ElevenLabs voice IDs with premium natural voices
    const voiceMap: Record<string, string> = {
      // Historical Figures - Premium voices that match their characteristics
      'John F. Kennedy': 'jgZhwQhGPa2RZhtCI0j0',    // Custom JFK voice from ElevenLabs
      'Abraham Lincoln': 'onwK4e9ZLuTAKqWW03F9',    // Daniel - Deep, thoughtful male voice
      'Winston Churchill': 'CwhRBWXzGAHq8TQ4Fs17',   // Roger - Professional, distinguished male voice
      'Franklin D. Roosevelt': 'bIHbv24MWmeRgasZH58o', // Will - Confident, commanding male voice
      'Theodore Roosevelt': 'N2lVS1w4EtoT3dr4eOWO',   // Callum - Strong, energetic male voice
      'Napoleon Bonaparte': 'cjVigY5qzO86Huf0OWal',   // Eric - Confident European male voice
      'Albert Einstein': '5rAEJ3ntjdwPSijjydPl',      // Einstein - Intellectual, thoughtful voice
      'Leonardo da Vinci': 'TX3LPaxmHKxFdv7VOQHJ',    // Liam - Creative, renaissance voice
      'Shakespeare': 'nPczCjzI2devNBz1zQrb',          // Brian - British, literary voice
      
      // Female Historical Figures
      'Marie Curie': 'EXAVITQu4vr4xnSDxMaL',          // Sarah - Professional, intelligent female voice
      'Cleopatra': 'XB0fDUnXU5powFXDhCwa',            // Charlotte - Regal, commanding female voice
      'Joan of Arc': 'cgSgspJ2msm6clMCkdW9',          // Jessica - Strong, determined female voice
      'Elizabeth I': 'FGY2WhTYpPnrIDTdsKH5',          // Laura - Royal, authoritative female voice
      
      // Fallback voices for generic names
      'Einstein': '5rAEJ3ntjdwPSijjydPl',
      'Carsten': 'DKCevyuNm5sbcmJ7NN8a',
      'Brian': 'nPczCjzI2devNBz1zQrb',
      'Daniel': 'onwK4e9ZLuTAKqWW03F9',
      'George': 'JBFqnCBsd6RMkjVDRZzb',
      'Eric': 'cjVigY5qzO86Huf0OWal',
      'Liam': 'TX3LPaxmHKxFdv7VOQHJ',
      'Will': 'bIHbv24MWmeRgasZH58o',
      'Callum': 'N2lVS1w4EtoT3dr4eOWO',
      'Roger': 'CwhRBWXzGAHq8TQ4Fs17',
      'Sarah': 'EXAVITQu4vr4xnSDxMaL',
      'Laura': 'FGY2WhTYpPnrIDTdsKH5',
      'Charlotte': 'XB0fDUnXU5powFXDhCwa',
      'Alice': 'Xb7hH8MSUJpSbSDYk0k2',
      'Jessica': 'cgSgspJ2msm6clMCkdW9',
      'Aria': '9BWtsMINqrJLrRacOk9x',
    };

    const voiceId = voice.includes('-cloned-') ? voice : (voiceMap[voice] || voiceMap['John F. Kennedy']);

    console.log(`Generating speech for: "${text.substring(0, 50)}..." with voice: ${voice} (${voiceId})`);

    // Handle auto-cloned voices vs preset voices
    let response;
    
    if (voice.includes('-cloned-')) {
      // For auto-cloned voices, use the specific historical figure's voice
      // Extract figure name to find appropriate fallback
      let fallbackVoiceId = voiceMap['John F. Kennedy']; // Use JFK as default since it's presidential
      
      if (voice.includes('John F. Kennedy') || voice.includes('john-f-kennedy')) {
        fallbackVoiceId = voiceMap['John F. Kennedy'];
      } else if (voice.includes('Abraham Lincoln') || voice.includes('lincoln')) {
        fallbackVoiceId = voiceMap['Abraham Lincoln'];
      } else if (voice.includes('Winston Churchill') || voice.includes('churchill')) {
        fallbackVoiceId = voiceMap['Winston Churchill'];
      } else if (voice.includes('Napoleon') || voice.includes('napoleon')) {
        fallbackVoiceId = voiceMap['Napoleon Bonaparte'];
      } else if (voice.includes('Einstein') || voice.includes('albert-einstein')) {
        fallbackVoiceId = voiceMap['Albert Einstein'];
      }
      
      console.log(`Using fallback voice ${fallbackVoiceId} for auto-cloned voice ${voice}`);
      
      // Call ElevenLabs TTS API with fallback voice
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.8,
            similarity_boost: 0.9,
            style: 0.3,
            use_speaker_boost: true
          }
        }),
      });
    } else {
      // Regular preset voice handling
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
    }

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

    console.log(`Successfully generated natural OpenAI audio of ${audioBuffer.byteLength} bytes`);

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