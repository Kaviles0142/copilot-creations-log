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
    const { text, voice: customVoice, figure_name, figure_id, language, is_user_host } = await req.json();

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

    console.log(`\n========== NEW TTS REQUEST ==========`);
    console.log(`📝 Figure: ${figure_name || 'unknown'} (${figure_id || 'unknown'})`);
    console.log(`📏 Text length: ${text.length} chars`);
    console.log(`🎙️ Custom voice: ${customVoice || 'auto'}`);
    console.log(`🌍 Language: ${language || 'auto'}`);
    console.log(`👤 Is user host: ${is_user_host || false}`);
    console.log(`📄 Text preview: ${text.substring(0, 100)}...`);

    // Generate cache key from text content (first attempt without voice for broader reuse)
    const cacheKey = text.substring(0, 500); // Use first 500 chars as key
    
    // Check cache first
    console.log(`🔍 Checking cache for text: "${text.substring(0, 50)}..."`);
    const { data: cachedAudio, error: cacheError } = await supabase
      .from('audio_cache')
      .select('cached_audio, voice_id')
      .eq('text', text.substring(0, 1000)) // Match on text
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cacheError) {
      console.log(`⚠️ Cache check error:`, cacheError);
    }

    if (cachedAudio) {
      console.log(`✅ CACHE HIT - Using cached audio (voice: ${cachedAudio.voice_id})`);
      console.log(`========== RETURNING CACHED AUDIO ==========\n`);
      return new Response(
        JSON.stringify({
          audioContent: cachedAudio.cached_audio,
          voice: cachedAudio.voice_id,
          provider: 'azure',
          cached: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`❌ CACHE MISS - No cached audio found, will generate new...`);

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

    // Helper function to detect accent/region using AI
    const detectAccentRegion = async (figureName: string): Promise<string> => {
      console.log(`🤖 Detecting accent region for: ${figureName}`);
      
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
                content: `What accent region should "${figureName}" have? Reply with ONLY ONE of these exact options: american, british, south-african, australian, canadian, indian, irish, scottish, french, german, italian, spanish, russian, japanese, chinese, greek. Choose the most authentic accent for this person. Single word/phrase only, lowercase.`
              }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`❌ AI API error: ${response.status}`);
          return 'american';
        }

        const data = await response.json();
        const region = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'american';
        console.log(`✅ Detected accent region: ${region}`);
        return region;
      } catch (error) {
        console.error('❌ Error detecting accent region:', error);
        return 'american';
      }
    };


    // Language-to-voice mapping with native Azure Neural Voices
    const languageVoiceMap: { [key: string]: { male: string; female: string } } = {
      'en-US': {
        male: 'en-US-GuyNeural',
        female: 'en-US-JennyNeural'
      },
      'es-ES': {
        male: 'es-ES-AlvaroNeural',
        female: 'es-ES-ElviraNeural'
      },
      'fr-FR': {
        male: 'fr-FR-HenriNeural',
        female: 'fr-FR-DeniseNeural'
      },
      'de-DE': {
        male: 'de-DE-ConradNeural',
        female: 'de-DE-KatjaNeural'
      },
      'it-IT': {
        male: 'it-IT-DiegoNeural',
        female: 'it-IT-ElsaNeural'
      },
      'ja-JP': {
        male: 'ja-JP-KeitaNeural',
        female: 'ja-JP-NanamiNeural'
      },
      'zh-CN': {
        male: 'zh-CN-YunxiNeural',
        female: 'zh-CN-XiaoxiaoNeural'
      },
      'ar-SA': {
        male: 'ar-SA-HamedNeural',
        female: 'ar-SA-ZariyahNeural'
      },
      'hi-IN': {
        male: 'hi-IN-MadhurNeural',
        female: 'hi-IN-SwaraNeural'
      },
      'ru-RU': {
        male: 'ru-RU-DmitryNeural',
        female: 'ru-RU-SvetlanaNeural'
      },
      'pt-BR': {
        male: 'pt-BR-AntonioNeural',
        female: 'pt-BR-FranciscaNeural'
      },
      'en-GB': {
        male: 'en-GB-RyanNeural',
        female: 'en-GB-SoniaNeural'
      }
    };

    // Region-to-voice mapping with Azure Neural Voices (GENDERED) - for nationality fallback
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

    // PRIORITY 1: User-selected custom voice (from frontend dropdown)
    // PRIORITY 2: User selected language
    // PRIORITY 3: For English - detect nationality for authentic accent
    // PRIORITY 4: For other languages - use standard voice
    let selectedVoice = '';
    let detectedRegion = 'american';
    
    const gender = detectGender(figure_name || '');
    console.log(`🎭 Detected gender: ${gender} for ${figure_name}`);
    
    // If user manually selected a voice, use it directly (ignore "auto" or empty)
    if (customVoice && customVoice !== 'auto' && customVoice.trim() !== '') {
      selectedVoice = customVoice;
      console.log(`✨ Using user-selected voice: ${selectedVoice}`);
    }
    
    // For user as host: Always force American English, skip nationality detection
    if (!selectedVoice && is_user_host) {
      selectedVoice = gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
      console.log(`👤 User is host - forcing American English: ${selectedVoice}`);
    }
    
    // For non-English languages: use standard voice from language map
    if (!selectedVoice && language && language !== 'en-US' && languageVoiceMap[language]) {
      selectedVoice = languageVoiceMap[language][gender];
      console.log(`🌍 Using language-specific voice: ${selectedVoice} for language: ${language}`);
    }
    
    // Detect nationality for: (1) English language selected, or (2) no language selected (auto mode)
    if (!selectedVoice && (language === 'en-US' || !language) && figure_name && figure_id) {
      console.log(`🔍 Detecting nationality for ${figure_name}...`);
      // Cache version - increment this when mapping logic changes
      const CACHE_VERSION = 'v2'; // Updated to force re-detection with new nationality mappings
      
      // Check cache first
      const { data: cachedMetadata } = await supabase
        .from('figure_metadata')
        .select('region, cache_version')
        .eq('figure_id', figure_id)
        .maybeSingle();

      // Auto-clear outdated cache
      if (cachedMetadata && (!cachedMetadata.cache_version || cachedMetadata.cache_version !== CACHE_VERSION)) {
        console.log(`🔄 Clearing outdated cache for ${figure_name} (old version: ${cachedMetadata.cache_version || 'v1'})`);
        await supabase
          .from('figure_metadata')
          .delete()
          .eq('figure_id', figure_id);
      }
      
      if (cachedMetadata?.region && cachedMetadata.cache_version === CACHE_VERSION) {
        console.log(`📦 Using cached region for ${figure_name}: ${cachedMetadata.region}`);
        detectedRegion = cachedMetadata.region;
      } else {
        // Detect accent region directly using AI (no mapping needed)
        detectedRegion = await detectAccentRegion(figure_name);
        
        console.log(`🗺️ AI detected accent region: ${detectedRegion}`);
        
        // Cache the result with version
        await supabase
          .from('figure_metadata')
          .upsert({
            figure_id,
            figure_name,
            region: detectedRegion,
            cache_version: CACHE_VERSION,
          }, {
            onConflict: 'figure_id'
          });
      }
      
      console.log(`🌍 Detected region: ${detectedRegion} for ${figure_name}`);
      
      // For English: Map to English regional variants
      if (language === 'en-US') {
        const englishVariants: Record<string, { male: string, female: string }> = {
          'german': { male: 'de-DE-ConradNeural', female: 'de-DE-KatjaNeural' },
          'french': { male: 'fr-FR-HenriNeural', female: 'fr-FR-DeniseNeural' },
          'italian': { male: 'it-IT-DiegoNeural', female: 'it-IT-ElsaNeural' },
          'spanish': { male: 'es-ES-AlvaroNeural', female: 'es-ES-ElviraNeural' },
          'russian': { male: 'ru-RU-DmitryNeural', female: 'ru-RU-SvetlanaNeural' },
          'south-african': { male: 'en-ZA-LukeNeural', female: 'en-ZA-LeahNeural' },
          'british': { male: 'en-GB-RyanNeural', female: 'en-GB-SoniaNeural' },
          'english': { male: 'en-GB-RyanNeural', female: 'en-GB-SoniaNeural' },
          'scottish': { male: 'en-GB-RyanNeural', female: 'en-GB-SoniaNeural' },
          'irish': { male: 'en-IE-ConnorNeural', female: 'en-IE-EmilyNeural' },
          'australian': { male: 'en-AU-WilliamNeural', female: 'en-AU-NatashaNeural' },
          'canadian': { male: 'en-CA-LiamNeural', female: 'en-CA-ClaraNeural' },
          'indian': { male: 'en-IN-PrabhatNeural', female: 'en-IN-NeerjaNeural' },
          'american': { male: 'en-US-GuyNeural', female: 'en-US-JennyNeural' }
        };
        
        selectedVoice = englishVariants[detectedRegion]?.[gender] || englishVariants['american'][gender];
        console.log(`🗣️ English with ${detectedRegion} accent: ${selectedVoice}`);
      }
      // For auto/no language: Use region-specific native voices
      else {
        selectedVoice = regionVoiceMap[detectedRegion]?.[gender] || regionVoiceMap['american'][gender];
        console.log(`🎙️ Native ${detectedRegion} voice: ${selectedVoice}`);
      }
    }
    
    // Final fallback to American English if still no voice selected
    if (!selectedVoice) {
      selectedVoice = gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
      console.log(`⚠️ Using fallback voice: ${selectedVoice}`);
    }

    console.log(`\n🎙️ FINAL VOICE SELECTION: ${selectedVoice}`);
    console.log(`🎭 Gender detected: ${gender}`);

    // Helper to add pronunciation hints for problematic names
    const addNamePronunciation = (text: string): string => {
      // List of names that might be mispronounced (spelled out as acronyms)
      const problematicNames = [
        'Avi Loeb',
        'Avi',
      ];
      
      let processedText = text;
      
      // Wrap each problematic name with say-as tags
      problematicNames.forEach(name => {
        // Case-insensitive replacement with word boundaries
        const regex = new RegExp(`\\b(${name})\\b`, 'gi');
        processedText = processedText.replace(regex, `<say-as interpret-as="name">$1</say-as>`);
      });
      
      return processedText;
    };

    // Preprocess text with pronunciation hints before escaping
    const textWithPronunciation = addNamePronunciation(text);

    // Helper to build SSML with a specific voice
    const buildSsml = (voiceName: string): string => `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voiceName}">
          <prosody rate="0.95" pitch="-5%">
            ${textWithPronunciation
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/&lt;say-as interpret-as="name"&gt;/g, '<say-as interpret-as="name">')
              .replace(/&lt;\/say-as&gt;/g, '</say-as>')}
          </prosody>
        </voice>
      </speak>
    `;

    // Low-level Azure call so we can retry with a fallback voice on specific errors
    const callAzureTTS = async (voiceName: string) => {
      const ssml = buildSsml(voiceName);

      console.log(`\n🌐 Calling Azure TTS API...`);
      console.log(`   Region: ${AZURE_SPEECH_REGION}`);
      console.log(`   Voice: ${voiceName}`);
      console.log(`   SSML length: ${ssml.length} chars`);
      
      const azureStartTime = Date.now();
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
      
      const azureDuration = Date.now() - azureStartTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`\n❌ AZURE API ERROR:`);
        console.error(`   Status: ${response.status}`);
        console.error(`   Duration: ${azureDuration}ms`);
        console.error(`   Error: ${errorText}`);
        console.error(`   Voice attempted: ${voiceName}`);
        throw new Error(`Azure TTS API error: ${response.status}`);
      }
      
      console.log(`✅ Azure API success in ${azureDuration}ms`);

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
      return { base64Audio, byteLength: audioBuffer.byteLength, voiceName };
    };

    // First attempt: use the selected voice based on language/region logic above
    let finalVoice = selectedVoice;
    let base64Audio = '';
    let audioByteLength = 0;

    try {
      const result = await callAzureTTS(selectedVoice);
      base64Audio = result.base64Audio;
      audioByteLength = result.byteLength;
      finalVoice = result.voiceName;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Specifically handle Azure 429 quota/voice limit errors by retrying with a safe fallback voice
      if (message.includes('Azure TTS API error: 429')) {
        const fallbackVoice = gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
        console.warn(`⚠️ Azure 429 for voice ${selectedVoice}, retrying with fallback voice: ${fallbackVoice}`);

        // Only retry if the fallback is actually different
        if (fallbackVoice !== selectedVoice) {
          const result = await callAzureTTS(fallbackVoice);
          base64Audio = result.base64Audio;
          audioByteLength = result.byteLength;
          finalVoice = result.voiceName;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Generated Azure TTS audio: ${audioByteLength} bytes`);
    console.log(`   Base64 length: ${base64Audio.length} chars`);

    // Cache the audio for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    console.log(`💾 Caching audio...`);
    const { error: cacheInsertError } = await supabase
      .from('audio_cache')
      .upsert({
        text: text.substring(0, 1000), // Match key length
        voice_id: finalVoice,
        cached_audio: base64Audio,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'text,voice_id'
      });

    if (cacheInsertError) {
      console.log(`⚠️ Cache insert warning:`, cacheInsertError);
    } else {
      console.log(`✅ Audio cached successfully (expires: ${expiresAt.toISOString().substring(0, 10)})`);
    }

    console.log(`========== REQUEST COMPLETE ==========\n`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: finalVoice,
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
