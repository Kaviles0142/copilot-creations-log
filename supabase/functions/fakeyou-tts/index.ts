import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FAKEYOU_API_BASE = 'https://api.fakeyou.com';
const FAKEYOU_CDN_BASE = 'https://storage.googleapis.com/vocodes-public';

// Cache session cookie (persists for lifetime of function instance)
let sessionCookie: string | null = null;

interface FakeYouVoice {
  model_token: string;
  title: string;
  creator_display_name: string;
  creator_username: string;
  ietf_language_tag: string;
  ietf_primary_language_subtag: string;
  maybe_suggested_unique_bot_command: string | null;
  category_tokens: string[];
  created_at: string;
  updated_at: string;
}

// Login to FakeYou and get session cookie
async function loginToFakeYou(): Promise<string> {
  console.log('🔐 Logging in to FakeYou...');
  
  const username = Deno.env.get('FAKEYOU_USERNAME');
  const password = Deno.env.get('FAKEYOU_PASSWORD');
  
  if (!username || !password) {
    throw new Error('FakeYou credentials not configured');
  }
  
  const response = await fetch(`${FAKEYOU_API_BASE}/v1/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username_or_email: username,
      password: password,
    }),
  });
  
  const json = await response.json();
  
  if (!json.success) {
    console.error('❌ FakeYou login failed:', json);
    throw new Error('FakeYou authentication failed');
  }
  
  // Extract cookie from response headers
  const cookieHeader = response.headers.get('set-cookie');
  const cookie = cookieHeader?.match(/session=([^;]+)/)?.[1];
  
  if (!cookie) {
    throw new Error('Failed to extract session cookie');
  }
  
  console.log('✅ Successfully logged in to FakeYou');
  return cookie;
}

// Get authenticated headers for FakeYou API requests
async function getAuthHeaders(): Promise<HeadersInit> {
  // Use cached cookie if available
  if (!sessionCookie) {
    sessionCookie = await loginToFakeYou();
  }
  
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'credentials': 'include',
    'cookie': `session=${sessionCookie}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, text, voiceToken, jobToken, figureName, categoryFilter, searchTerm, audioUrl } = await req.json();

    console.log(`FakeYou TTS action: ${action}`);

    switch (action) {
      case 'list_voices':
        return await listVoices(categoryFilter, searchTerm);
      
      case 'search_historical_voices':
        // Dedicated action for searching historical figures
        if (!figureName) {
          throw new Error('Missing figureName for historical voice search');
        }
        return await listVoices(undefined, figureName);
      
      case 'multi_search_voices':
        // Multi-term search for better voice discovery
        const { searchTerms } = await req.json();
        if (!searchTerms || !Array.isArray(searchTerms)) {
          throw new Error('Missing searchTerms array for multi-search');
        }
        return await multiSearchVoices(searchTerms);
      
      case 'generate_tts':
        if (!text || !voiceToken) {
          throw new Error('Missing text or voiceToken for TTS generation');
        }
        return await generateTTS(text, voiceToken);
      
      case 'check_status':
        if (!jobToken) {
          throw new Error('Missing jobToken for status check');
        }
        return await checkJobStatus(jobToken);
      
      case 'proxy_audio':
        if (!audioUrl) {
          throw new Error('Missing audioUrl for proxy');
        }
        return await proxyAudio(audioUrl);
      
      case 'sync_voices':
        return await syncVoicesToDatabase(figureName);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('FakeYou TTS error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function multiSearchVoices(searchTerms: string[]) {
  console.log(`🔍 Multi-search with ${searchTerms.length} terms: ${searchTerms.join(', ')}`);
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FAKEYOU_API_BASE}/v1/weights/list?weight_category=text_to_speech&page_size=6000`, {
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FakeYou API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.results) {
      throw new Error('Invalid response from FakeYou API');
    }
    
    let allVoices = data.results;
    console.log(`📊 Received ${allVoices.length} total voices`);
    
    // Filter for English voices
    allVoices = allVoices.filter((v: any) => v.maybe_ietf_primary_language_subtag === 'en');
    console.log(`🌐 English voices: ${allVoices.length}`);
    
    // Search for all terms and deduplicate
    const voiceMap = new Map();
    
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      const matches = allVoices.filter((v: any) => 
        v.title.toLowerCase().includes(termLower)
      );
      
      console.log(`  📝 "${term}": found ${matches.length} matches`);
      
      // Add to map (deduplicates by weight_token)
      for (const voice of matches) {
        if (!voiceMap.has(voice.weight_token)) {
          voiceMap.set(voice.weight_token, voice);
        }
      }
    }
    
    const uniqueVoices = Array.from(voiceMap.values());
    console.log(`✅ Found ${uniqueVoices.length} unique voices across all search terms`);

    return new Response(
      JSON.stringify({
        success: true,
        count: uniqueVoices.length,
        voices: uniqueVoices.map((v: any) => ({
          voiceToken: v.weight_token,
          title: v.title,
          creator: v.creator_display_name,
          username: v.creator_username,
          language: v.maybe_ietf_language_tag,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('💥 multiSearchVoices failed:', error);
    throw error;
  }
}

async function listVoices(categoryFilter?: string, searchTerm?: string) {
  console.log('📋 Fetching voices from comprehensive weights endpoint...');
  
  try {
    const headers = await getAuthHeaders();
    // Use the comprehensive weights endpoint to get ALL 6000+ TTS voices
    const response = await fetch(`${FAKEYOU_API_BASE}/v1/weights/list?weight_category=text_to_speech&page_size=6000`, {
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FakeYou API error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.results) {
      console.error('❌ Invalid response from FakeYou:', data);
      throw new Error('Invalid response from FakeYou API');
    }
    
    let voices = data.results; // Changed from data.models to data.results
    console.log(`📊 Received ${voices.length} total voices from weights endpoint`);
    
    // Filter for English voices only for better quality
    const beforeLanguageFilter = voices.length;
    voices = voices.filter((v: any) => 
      v.maybe_ietf_primary_language_subtag === 'en'
    );
    console.log(`🌐 Language filter reduced voices from ${beforeLanguageFilter} to ${voices.length}`);
    
    // Filter by search term if provided (for finding historical figures)
    if (searchTerm) {
      const beforeSearchFilter = voices.length;
      const searchLower = searchTerm.toLowerCase();
      voices = voices.filter((v: any) => 
        v.title.toLowerCase().includes(searchLower)
      );
      console.log(`🔍 Search filter "${searchTerm}" reduced voices from ${beforeSearchFilter} to ${voices.length}`);
    }
    
    // Filter by category if provided
    if (categoryFilter) {
      const beforeFilter = voices.length;
      voices = voices.filter((v: any) => 
        v.category_tokens?.some((cat: string) => cat.includes(categoryFilter))
      );
      console.log(`🔍 Category filter reduced voices from ${beforeFilter} to ${voices.length}`);
    }

    console.log(`✅ Returning ${voices.length} English voices`);

    return new Response(
      JSON.stringify({
        success: true,
        count: voices.length,
        voices: voices.map((v: any) => ({
          voiceToken: v.weight_token, // Changed from model_token to weight_token
          title: v.title,
          creator: v.creator_display_name,
          username: v.creator_username,
          language: v.maybe_ietf_language_tag,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('💥 listVoices failed:', error);
    throw error;
  }
}

async function generateTTS(text: string, voiceToken: string) {
  console.log(`🎤 Generating TTS with voice token: ${voiceToken}`);
  console.log(`📝 Text length: ${text.length} characters`);
  
  try {
    // Generate a unique idempotency token
    const idempotencyToken = crypto.randomUUID();
    console.log(`🔑 Idempotency token: ${idempotencyToken}`);
    
    const requestBody = {
      uuid_idempotency_token: idempotencyToken,
      tts_model_token: voiceToken,
      inference_text: text,
    };
    
    console.log(`📤 Sending TTS request to FakeYou...`);
    const headers = await getAuthHeaders();
    const response = await fetch(`${FAKEYOU_API_BASE}/tts/inference`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FakeYou TTS API error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      throw new Error(`FakeYou TTS failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`📥 TTS response:`, JSON.stringify(data));
    
    if (!data.success) {
      console.error('❌ TTS request unsuccessful:', data);
      throw new Error('TTS request was not successful');
    }
    
    if (!data.inference_job_token) {
      console.error('❌ No job token received:', data);
      throw new Error('No job token in response');
    }

    console.log(`✅ TTS job started successfully: ${data.inference_job_token}`);

    return new Response(
      JSON.stringify({
        success: true,
        jobToken: data.inference_job_token,
        message: 'TTS generation started',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('💥 generateTTS failed:', error);
    throw error;
  }
}

async function checkJobStatus(jobToken: string) {
  console.log(`⏳ Checking status for job: ${jobToken}`);
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FAKEYOU_API_BASE}/tts/job/${jobToken}`, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Status check failed: ${response.status} - ${errorText}`);
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📊 Job status response:`, JSON.stringify(data));
    
    if (!data.success) {
      console.error('❌ Status check unsuccessful:', data);
      throw new Error('Status check response was not successful');
    }
    
    if (!data.state) {
      console.error('❌ No state in response:', data);
      throw new Error('No state in job status response');
    }

    const state = data.state;
    const status = state.status;
    
    console.log(`📈 Job status: ${status} (attempt ${state.attempt_count})`);
    
    // Construct audio URL if completed
    let audioUrl = null;
    if (status === 'complete_success' && state.maybe_public_bucket_wav_audio_path) {
      audioUrl = `${FAKEYOU_CDN_BASE}${state.maybe_public_bucket_wav_audio_path}`;
      console.log(`✅ Audio URL ready: ${audioUrl}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        jobToken: state.job_token,
        audioUrl: audioUrl,
        voiceTitle: state.title,
        attemptCount: state.attempt_count,
        statusDescription: state.maybe_extra_status_description,
        isComplete: status === 'complete_success',
        isFailed: status === 'complete_failure' || status === 'dead',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('💥 checkJobStatus failed:', error);
    throw error;
  }
}

async function proxyAudio(audioUrl: string) {
  console.log(`🎵 Proxying audio from: ${audioUrl}`);
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(audioUrl, { headers });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch audio: ${response.status}`);
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const audioData = await response.arrayBuffer();
    console.log(`✅ Audio fetched successfully (${audioData.byteLength} bytes)`);
    
    // Convert to base64 for JSON transport
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioData))
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        audioBase64: base64Audio,
        size: audioData.byteLength
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('💥 proxyAudio failed:', error);
    throw error;
  }
}

async function syncVoicesToDatabase(figureName?: string) {
  console.log('Syncing FakeYou voices to database using comprehensive endpoint...');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch ALL voices with authentication using the comprehensive endpoint
  const headers = await getAuthHeaders();
  const response = await fetch(`${FAKEYOU_API_BASE}/v1/weights/list?weight_category=text_to_speech&page_size=6000`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  let voices = data.results; // Changed from data.models to data.results

  // Filter for English voices only
  voices = voices.filter((v: any) => v.maybe_ietf_primary_language_subtag === 'en');

  // If figureName provided, try to find matching voices
  if (figureName) {
    const searchTerm = figureName.toLowerCase();
    voices = voices.filter((v: any) => 
      v.title.toLowerCase().includes(searchTerm)
    );
  }

  console.log(`Syncing ${voices.length} voices to database...`);

  let syncedCount = 0;
  const errors = [];

  for (const voice of voices) {
    try {
      // Create a figure_id from the title
      const figureId = voice.title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      const { error } = await supabase
        .from('cloned_voices')
        .upsert({
          voice_id: voice.weight_token, // Changed from model_token to weight_token
          voice_name: voice.title,
          figure_id: figureId,
          figure_name: voice.title,
          provider: 'fakeyou',
          source_description: `Created by ${voice.creator_display_name}`,
          audio_quality_score: 80, // Default score for FakeYou voices
          is_active: true,
        }, {
          onConflict: 'voice_id',
        });

      if (error) {
        errors.push({ voice: voice.title, error: error.message });
      } else {
        syncedCount++;
      }
    } catch (err) {
      errors.push({ voice: voice.title, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  console.log(`Synced ${syncedCount} voices successfully`);

  return new Response(
    JSON.stringify({
      success: true,
      syncedCount,
      totalVoices: voices.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
