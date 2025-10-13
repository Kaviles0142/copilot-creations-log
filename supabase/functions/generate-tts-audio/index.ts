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
    const { text, figureName, voiceId } = await req.json();

    if (!text) {
      throw new Error('text is required');
    }

    console.log('🎤 Generating TTS for:', figureName);

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    // Select appropriate voice based on figure or use provided voiceId
    const selectedVoice = voiceId || selectVoiceForFigure(figureName);
    console.log('🎙️ Using voice:', selectedVoice);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5', // Fast, high quality
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs error:', errorText);
      throw new Error(`TTS generation failed: ${errorText}`);
    }

    // Get audio as array buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const audioBase64 = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log('✅ TTS audio generated');

    return new Response(JSON.stringify({
      audioContent: audioBase64,
      voiceId: selectedVoice
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function selectVoiceForFigure(figureName: string): string {
  const name = figureName.toLowerCase();
  
  // Male voices
  const maleVoices = {
    british: 'N2lVS1w4EtoT3dr4eOWO', // Callum - British
    american: 'bIHbv24MWmeRgasZH58o', // Will - American
    authoritative: 'cjVigY5qzO86Huf0OWal', // Eric - Authoritative
    mature: 'onwK4e9ZLuTAKqWW03F9', // Daniel - Mature
  };

  // Female voices
  const femaleVoices = {
    british: 'Xb7hH8MSUJpSbSDYk0k2', // Alice - British
    american: 'EXAVITQu4vr4xnSDxMaL', // Sarah - American
    warm: 'pFZP5JQG7iQjIQuC4Bku', // Lily - Warm
  };

  // Detect gender and select voice
  const femaleNames = ['marie', 'cleopatra', 'joan', 'elizabeth', 'michelle', 'rosa', 'harriet', 'ada', 'jane'];
  const isFemale = femaleNames.some(fn => name.includes(fn));

  if (isFemale) {
    // British figures
    if (name.includes('elizabeth') || name.includes('austen')) {
      return femaleVoices.british;
    }
    return femaleVoices.american;
  } else {
    // British figures
    if (name.includes('churchill') || name.includes('shakespeare') || name.includes('darwin')) {
      return maleVoices.british;
    }
    // Authoritative figures
    if (name.includes('lincoln') || name.includes('washington') || name.includes('roosevelt')) {
      return maleVoices.authoritative;
    }
    return maleVoices.american;
  }
}
