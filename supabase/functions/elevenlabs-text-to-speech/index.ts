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
    const { text, voice = "Brian", model = "eleven_multilingual_v2", voice_settings } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
    }

    console.log(`Generating speech with ElevenLabs for voice: ${voice}`);
    console.log(`Text: "${text.substring(0, 100)}..."`);

    // Map voice names to ElevenLabs voice IDs, or use direct voice ID if provided
    const voiceMap: Record<string, string> = {
      'Brian': 'nPczCjzI2devNBz1zQrb',
      'Alice': 'Xb7hH8MSUJpSbSDYk0k2',
      'Charlie': 'IKne3meq5aSn9XLyUdCD',
      'Sarah': 'EXAVITQu4vr4xnSDxMaL',
      'George': 'JBFqnCBsd6RMkjVDRZzb',
      'Roger': 'CwhRBWXzGAHq8TQ4Fs17',
      'Aria': '9BWtsMINqrJLrRacOk9x',
      'Laura': 'FGY2WhTYpPnrIDTdsKH5',
      'Callum': 'N2lVS1w4EtoT3dr4eOWO',
      'River': 'SAz9YHcvj6GT2YYXdXww',
      'Liam': 'TX3LPaxmHKxFdv7VOQHJ',
      'Charlotte': 'XB0fDUnXU5powFXDhCwa',
      'Matilda': 'XrExE9yKIg1WjnnlVkGX',
      'Will': 'bIHbv24MWmeRgasZH58o',
      'Jessica': 'cgSgspJ2msm6clMCkdW9',
      'Eric': 'cjVigY5qzO86Huf0OWal',
      'Chris': 'iP95p4xoKVk53GoZ742B',
      'Daniel': 'onwK4e9ZLuTAKqWW03F9',
      'Lily': 'pFZP5JQG7iQjIQuC4Bku',
      'Bill': 'pqHfZKP75CvOlQylNhV4',
      // Historical figures with specific voices
      'John F. Kennedy': '2vubyVoGjNJ5HPga4SkV', // Boston accent voice
      'default': 'nPczCjzI2devNBz1zQrb' // Brian as default
    };

    // If voice looks like a voice ID (alphanumeric with length > 10), use it directly
    // Otherwise, map it from the voiceMap
    const voiceId = (voice.length > 10 && /^[a-zA-Z0-9]+$/.test(voice)) 
      ? voice 
      : (voiceMap[voice] || voiceMap['Brian']);
    
    console.log(`Using ElevenLabs voice ID: ${voiceId} for voice: ${voice}`);

    // Call ElevenLabs TTS API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: voice_settings || {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert to base64 in chunks to avoid call stack size exceeded
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binary);

    console.log(`Successfully generated ElevenLabs audio of ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: voice,
        voiceId: voiceId,
        provider: 'elevenlabs'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in elevenlabs-text-to-speech:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: 'elevenlabs'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});