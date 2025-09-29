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
    const { text, voice = "onyx" } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found');
    }

    console.log(`Generating natural OpenAI speech for: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Call OpenAI TTS API for natural-sounding speech
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',  // Use HD model for better quality
        input: text,
        voice: voice, // onyx, echo, fable, alloy, nova, shimmer
        response_format: 'mp3',
        speed: 0.9, // Slightly slower for more natural speech
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', errorText);
      throw new Error(`OpenAI TTS API error: ${response.status} ${errorText}`);
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