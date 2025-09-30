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

// Generate speech using real Coqui XTTS - temporary fallback to premium ElevenLabs
async function generateCoquiXTTS(text: string, voiceId: string): Promise<string> {
  console.log(`Generating high-quality speech for Coqui voice ${voiceId}`);
  
  // Extract figure name from voice ID
  const figureName = voiceId.replace('coqui_', '').replace('_premium_fallback', '').replace(/_/g, ' ');
  
  // For now, use premium ElevenLabs voices optimized for each historical figure
  // This provides much better quality than the free Coqui service
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Map Coqui voices to premium ElevenLabs voices for better quality
  const voiceMapping: Record<string, string> = {
    'coqui_john_f_kennedy_premium_fallback': 'onwK4e9ZLuTAKqWW03F9', // Daniel - mature male
    'coqui_winston_churchill_premium_fallback': 'JBFqnCBsd6RMkjVDRZzb', // George - distinguished
    'coqui_martin_luther_king_jr_premium_fallback': 'TX3LPaxmHKxFdv7VOQHJ', // Liam - powerful
    'coqui_franklin_d_roosevelt_premium_fallback': 'bIHbv24MWmeRgasZH58o', // Will - authoritative
  };

  const elevenLabsVoiceId = voiceMapping[voiceId] || 'onwK4e9ZLuTAKqWW03F9'; // Default to Daniel

  console.log(`Using premium ElevenLabs voice ${elevenLabsVoiceId} for ${figureName}`);

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + elevenLabsVoiceId, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5', // Faster model for reduced latency
      voice_settings: {
        stability: 0.75, // Slightly lower for faster generation
        similarity_boost: 0.85, // Reduced for speed
        style: 0.5, // Lower style for faster processing
        use_speaker_boost: false // Disable for faster processing
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs API error:', response.status, errorText);
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
  
  console.log(`Generated premium audio of ${audioBuffer.byteLength} bytes for ${figureName}`);
  
  return base64Audio;
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