import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice, figure_name, figure_id } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
    const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      throw new Error('Azure Speech credentials not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`Generating Azure TTS for ${figure_name || 'figure'}`);
    console.log(`Text length: ${text.length} characters`);

    // Detect gender from figure name
    const detectGender = (name: string): 'male' | 'female' => {
      const nameLower = name.toLowerCase();
      
      // Female figures
      const femaleNames = [
        'joan of arc', 'cleopatra', 'marie curie', 'rosa parks', 'mother teresa',
        'victoria', 'elizabeth', 'catherine', 'anne frank', 'amelia earhart',
        'harriet tubman', 'malala', 'frida kahlo', 'ada lovelace', 'florence nightingale',
        'jane austen', 'emily dickinson', 'virginia woolf', 'simone de beauvoir',
        'eleanor roosevelt', 'margaret thatcher', 'indira gandhi', 'benazir bhutto',
        'mary', 'anne', 'jane', 'emily', 'rosa', 'harriet', 'ada', 'florence'
      ];
      
      if (femaleNames.some(n => nameLower.includes(n))) {
        return 'female';
      }
      
      return 'male'; // Default
    };

    // Helper function to detect nationality using AI
    const detectNationality = async (figureName: string): Promise<string> => {
      console.log(`🤖 Detecting nationality for: ${figureName}`);
      
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableApiKey) {
        console.log('⚠️ No LOVABLE_API_KEY found, using fallback');
        return 'american';
      }

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: `What is the nationality of "${figureName}"? Reply with ONLY the nationality (e.g., "french", "german", "greek", "american", "egyptian", "chinese", "italian", "spanish", "russian", "japanese", "indian", "english", "british"). Be specific and use lowercase. Single word only.`
              }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`❌ AI API error: ${response.status}`);
          return 'american';
        }

        const data = await response.json();
        const nationality = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'american';
        console.log(`✅ Detected nationality: ${nationality}`);
        return nationality;
      } catch (error) {
        console.error('❌ Error detecting nationality:', error);
        return 'american';
      }
    };

    // Helper function to map nationality to region
    const mapNationalityToRegion = (nationality: string): string => {
      const mapping: Record<string, string> = {
        'french': 'french',
        'german': 'german',
        'italian': 'italian',
        'spanish': 'spanish',
        'chinese': 'chinese',
        'japanese': 'japanese',
        'russian': 'russian',
        'indian': 'indian',
        'greek': 'greek',
        'egyptian': 'greek',
        'english': 'american',
        'american': 'american',
        'british': 'british',
      };
      return mapping[nationality] || 'american';
    };

    // Region-to-voice mapping with Azure Neural Voices (GENDERED)
    const regionVoiceMap: { [key: string]: { male: string; female: string } } = {
      'german': {
        male: 'de-DE-ConradNeural',
        female: 'de-DE-KatjaNeural'
      },
      'british': {
        male: 'en-GB-RyanNeural',
        female: 'en-GB-SoniaNeural'
      },
      'french': {
        male: 'fr-FR-HenriNeural',
        female: 'fr-FR-DeniseNeural'
      },
      'italian': {
        male: 'it-IT-DiegoNeural',
        female: 'it-IT-ElsaNeural'
      },
      'spanish': {
        male: 'es-ES-AlvaroNeural',
        female: 'es-ES-ElviraNeural'
      },
      'russian': {
        male: 'ru-RU-DmitryNeural',
        female: 'ru-RU-SvetlanaNeural'
      },
      'japanese': {
        male: 'ja-JP-KeitaNeural',
        female: 'ja-JP-NanamiNeural'
      },
      'chinese': {
        male: 'zh-CN-YunxiNeural',
        female: 'zh-CN-XiaoxiaoNeural'
      },
      'indian': {
        male: 'en-IN-PrabhatNeural',
        female: 'en-IN-NeerjaNeural'
      },
      'greek': {
        male: 'el-GR-NestorasNeural',
        female: 'el-GR-AthinaNeural'
      },
      'american': {
        male: 'en-US-GuyNeural',
        female: 'en-US-JennyNeural'
      }
    };

    // Auto-select voice based on figure's region AND gender ONLY if voice is "auto" or undefined
    let selectedVoice = voice;
    let detectedRegion = 'american';
    
    // Only auto-detect if user hasn't manually selected a voice
    if ((voice === 'auto' || !voice || voice === 'de-DE-ConradNeural') && figure_name && figure_id) {
      // Check cache first
      const { data: cachedMetadata } = await supabase
        .from('figure_metadata')
        .select('region, nationality')
        .eq('figure_id', figure_id)
        .maybeSingle();

      if (cachedMetadata?.region) {
        console.log(`📦 Using cached region for ${figure_name}: ${cachedMetadata.region}`);
        detectedRegion = cachedMetadata.region;
      } else {
        // Detect nationality using AI
        const nationality = await detectNationality(figure_name);
        detectedRegion = mapNationalityToRegion(nationality);
        
        console.log(`🗺️ Detected nationality: ${nationality}, mapped to region: ${detectedRegion}`);
        
        // Cache the result
        await supabase
          .from('figure_metadata')
          .upsert({
            figure_id,
            figure_name,
            nationality,
            region: detectedRegion,
          }, {
            onConflict: 'figure_id'
          });
      }
      
      const detectedGender = detectGender(figure_name);
      selectedVoice = regionVoiceMap[detectedRegion][detectedGender];
      console.log(`🎤 Auto mode: ${detectedRegion} ${detectedGender} → Voice: ${selectedVoice}`);
    } else {
      console.log(`🎤 Using manually selected voice: ${selectedVoice}`);
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
