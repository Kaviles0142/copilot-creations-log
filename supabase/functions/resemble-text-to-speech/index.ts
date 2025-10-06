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

    // Call Resemble.ai TTS API - using direct synthesis endpoint
    const apiUrl = `https://p.cluster.resemble.ai/synthesize`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEMBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_uuid: voiceId,
        data: text
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resemble.ai API error:', response.status, errorText.substring(0, 500));
      
      // Check if this is an HTML error page (common issue we've seen)
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        console.error('Received HTML error page from Resemble.ai - API may be down or wrong endpoint');
        throw new Error('Resemble.ai service unavailable - received HTML error page');
      }
      
      throw new Error(`Resemble.ai API error: ${response.status}`);
    }

    console.log('✅ Resemble.ai API responded successfully');
    const result = await response.json();
    console.log('Response structure:', Object.keys(result));
    
    // The direct synthesis endpoint returns the audio directly or as a URL
    // Check for different possible response formats
    let audioBuffer: ArrayBuffer;
    
    if (result.audio_content) {
      // Resemble returns base64 audio in audio_content field
      console.log('Using audio_content from Resemble.ai response');
      const audioData = result.audio_content;
      const binaryString = atob(audioData);
      const uint8 = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = uint8.buffer;
    } else if (result.audio_url || result.url) {
      // If it returns a URL, download it
      const audioUrl = result.audio_url || result.url;
      console.log('Downloading audio from URL:', audioUrl);
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error('Failed to download generated audio');
      }
      audioBuffer = await audioResponse.arrayBuffer();
    } else if (result.audio || result.data) {
      // If it returns base64 audio directly
      const audioData = result.audio || result.data;
      console.log('Using direct audio data from response');
      const binaryString = atob(audioData);
      const uint8 = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = uint8.buffer;
    } else {
      console.error('Unexpected response format:', JSON.stringify(result).substring(0, 200));
      throw new Error('Unexpected response format from Resemble.ai');
    }

    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert to base64 in chunks
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binary);

    console.log(`✅ Successfully generated Resemble.ai audio of ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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

  // Enhanced voice mapping for historical figures
  const voiceMapping: { [key: string]: string } = {
    // Male voices - ElevenLabs voice IDs
    'Brian': 'nPczCjzI2devNBz1zQrb',     // Deep, presidential
    'Bill': 'pqHfZKP75CvOlQylNhV4',      // Deep, resonant  
    'George': 'JBFqnCBsd6RMkjVDRZzb',    // British accent
    'Daniel': 'onwK4e9ZLuTAKqWW03F9',    // Confident, clear
    'Eric': 'cjVigY5qzO86Huf0OWal',      // Intellectual
    'Will': 'bIHbv24MWmeRgasZH58o',      // Wise, measured
    'Callum': 'N2lVS1w4EtoT3dr4eOWO',    // British, dramatic
    'Chris': 'iP95p4xoKVk53GoZ742B',     // Scientific
    'Liam': 'TX3LPaxmHKxFdv7VOQHJ',      // Young, powerful
    
    // Female voices
    'Sarah': 'EXAVITQu4vr4xnSDxMaL',     // Intelligent
    'Laura': 'FGY2WhTYpPnrIDTdsKH5',     // British, authoritative
    'Charlotte': 'XB0fDUnXU5powFXDhCwa',  // Regal
    'Jessica': 'cgSgspJ2msm6clMCkdW9',    // Young, determined
    'Alice': 'Xb7hH8MSUJpSbSDYk0k2',     // Literary, thoughtful
    'Aria': '9BWtsMINqrJLrRacOk9x',      // Passionate, artistic
  };

  // Get the appropriate ElevenLabs voice ID
  const fallbackVoiceId = voiceMapping[voice] || 'onwK4e9ZLuTAKqWW03F9'; // Default to Daniel
  console.log(`Using ElevenLabs voice ${voice} (ID: ${fallbackVoiceId}) for fallback`);
  
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