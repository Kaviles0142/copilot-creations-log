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

    // Comprehensive figure-to-region detection
    const detectRegion = (name: string): string => {
      const nameLower = name.toLowerCase();
      
      // German figures
      if (nameLower.includes('einstein') || nameLower.includes('bach') || 
          nameLower.includes('beethoven') || nameLower.includes('goethe') ||
          nameLower.includes('nietzsche') || nameLower.includes('kant') ||
          nameLower.includes('marx') || nameLower.includes('bismarck')) {
        return 'german';
      }
      
      // British figures
      if (nameLower.includes('churchill') || nameLower.includes('shakespeare') ||
          nameLower.includes('newton') || nameLower.includes('darwin') ||
          nameLower.includes('dickens') || nameLower.includes('austen') ||
          nameLower.includes('victoria') || nameLower.includes('elizabeth')) {
        return 'british';
      }
      
      // French figures
      if (nameLower.includes('napoleon') || nameLower.includes('joan of arc') ||
          nameLower.includes('voltaire') || nameLower.includes('rousseau') ||
          nameLower.includes('descartes') || nameLower.includes('pasteur') ||
          nameLower.includes('de gaulle') || nameLower.includes('marie curie')) {
        return 'french';
      }
      
      // Italian figures
      if (nameLower.includes('da vinci') || nameLower.includes('galileo') ||
          nameLower.includes('michelangelo') || nameLower.includes('caesar') ||
          nameLower.includes('dante') || nameLower.includes('machiavelli')) {
        return 'italian';
      }
      
      // Spanish figures
      if (nameLower.includes('cervantes') || nameLower.includes('picasso') ||
          nameLower.includes('goya') || nameLower.includes('columbus')) {
        return 'spanish';
      }
      
      // Russian figures
      if (nameLower.includes('tolstoy') || nameLower.includes('dostoyevsky') ||
          nameLower.includes('tchaikovsky') || nameLower.includes('lenin') ||
          nameLower.includes('stalin') || nameLower.includes('catherine')) {
        return 'russian';
      }
      
      // Japanese figures
      if (nameLower.includes('hirohito') || nameLower.includes('akira') ||
          nameLower.includes('musashi') || nameLower.includes('tokugawa')) {
        return 'japanese';
      }
      
      // Chinese figures
      if (nameLower.includes('confucius') || nameLower.includes('mao') ||
          nameLower.includes('sun tzu') || nameLower.includes('lao tzu')) {
        return 'chinese';
      }
      
      // Indian figures
      if (nameLower.includes('gandhi') || nameLower.includes('tagore') ||
          nameLower.includes('nehru') || nameLower.includes('ashoka')) {
        return 'indian';
      }
      
      // Greek figures (Ancient)
      if (nameLower.includes('plato') || nameLower.includes('aristotle') ||
          nameLower.includes('socrates') || nameLower.includes('alexander')) {
        return 'greek';
      }
      
      return 'american'; // Default fallback
    };

    // Region-to-voice mapping with Azure Neural Voices
    const regionVoiceMap: { [key: string]: string } = {
      'german': 'de-DE-ConradNeural',          // German male
      'british': 'en-GB-RyanNeural',           // British male
      'french': 'fr-FR-HenriNeural',           // French male
      'italian': 'it-IT-DiegoNeural',          // Italian male
      'spanish': 'es-ES-AlvaroNeural',         // Spanish male
      'russian': 'ru-RU-DmitryNeural',         // Russian male
      'japanese': 'ja-JP-KeitaNeural',         // Japanese male
      'chinese': 'zh-CN-YunxiNeural',          // Chinese male
      'indian': 'en-IN-PrabhatNeural',         // Indian English male
      'greek': 'el-GR-NestorasNeural',         // Greek male
      'american': 'en-US-GuyNeural',           // American male (default)
    };

    // Auto-select voice based on figure's region
    let selectedVoice = voice;
    if (figure_name) {
      const detectedRegion = detectRegion(figure_name);
      selectedVoice = regionVoiceMap[detectedRegion];
      console.log(`🌍 Detected region: ${detectedRegion} → Voice: ${selectedVoice}`);
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
