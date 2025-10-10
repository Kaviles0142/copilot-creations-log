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
    const { text, voice = "de-DE-ConradNeural", figure_name } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      throw new Error('Azure Speech credentials not configured');
    }

    console.log(`Generating Azure TTS for ${figure_name || 'figure'} with voice: ${voice}`);
    console.log(`Text length: ${text.length} characters`);

    // Voice mapping for different figures
    const voiceMapping: { [key: string]: string } = {
      // German-accented English voices (perfect for Einstein)
      'german-male': 'de-DE-ConradNeural',
      'german-male-2': 'de-DE-KlausNeural',
      
      // British English voices
      'british-male': 'en-GB-RyanNeural',
      'british-female': 'en-GB-SoniaNeural',
      
      // American voices (fallback)
      'american-male': 'en-US-GuyNeural',
      'american-female': 'en-US-JennyNeural',
    };

    // Auto-select voice based on figure if not specified
    let selectedVoice = voice;
    if (figure_name?.toLowerCase().includes('einstein')) {
      selectedVoice = 'de-DE-ConradNeural'; // German accent
    } else if (figure_name?.toLowerCase().includes('churchill')) {
      selectedVoice = 'en-GB-RyanNeural'; // British
    }

    // Build SSML for better control
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${selectedVoice}">
          <prosody rate="0.95" pitch="-5%">
            ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </prosody>
        </voice>
      </speak>
    `;

    // Call Azure Speech API
    const response = await fetch(
      `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure TTS API error:', response.status, errorText);
      throw new Error(`Azure TTS API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert to base64 in chunks to prevent memory issues
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binary);

    console.log(`✅ Generated Azure TTS audio: ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: selectedVoice,
        provider: 'azure'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in azure-text-to-speech:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        message: 'Azure TTS failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
