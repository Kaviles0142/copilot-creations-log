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
    const { text, voice = "default" } = await req.json();

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
    
    // Try fallback speech generation
    try {
      return await generateFallbackSpeech(
        (await req.json())?.text || 'Error occurred',
        (await req.json())?.voice || 'default'
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
  console.log('Generating fallback speech using browser TTS simulation');
  
  // Create a simple fallback by returning a success response
  // In a real implementation, you might use a different TTS service
  // or generate silent audio
  
  // Generate minimal audio data (silent audio)
  const sampleRate = 22050;
  const duration = Math.max(1, text.length * 0.05); // Estimate duration
  const numSamples = Math.floor(sampleRate * duration);
  
  // Create minimal WAV header + silent audio
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Silent audio data (all zeros)
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, 0, true);
  }
  
  // Convert to base64
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  const base64Audio = btoa(binary);
  
  console.log(`Generated fallback silent audio of ${buffer.byteLength} bytes`);
  
  return new Response(
    JSON.stringify({ 
      audioContent: base64Audio,
      fallback: true,
      message: 'Generated using fallback method - audio may be silent'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}