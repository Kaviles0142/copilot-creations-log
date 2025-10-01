import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FAKEYOU_API_BASE = 'https://api.fakeyou.com';
const FAKEYOU_CDN_BASE = 'https://storage.googleapis.com/vocodes-public';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, text, voiceToken, jobToken, figureName, categoryFilter } = await req.json();

    console.log(`FakeYou TTS action: ${action}`);

    switch (action) {
      case 'list_voices':
        return await listVoices(categoryFilter);
      
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
        const { audioUrl } = await req.json();
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

async function listVoices(categoryFilter?: string) {
  console.log('📋 Fetching voices from FakeYou API...');
  
  try {
    const response = await fetch(`${FAKEYOU_API_BASE}/tts/list`, {
      headers: {
        'Accept': 'application/json',
      },
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
    
    if (!data.success || !data.models) {
      console.error('❌ Invalid response from FakeYou:', data);
      throw new Error('Invalid response from FakeYou API');
    }
    
    let voices = data.models as FakeYouVoice[];
    console.log(`📊 Received ${voices.length} total voices`);
    
    // Filter by category if provided
    if (categoryFilter) {
      const beforeFilter = voices.length;
      voices = voices.filter(v => 
        v.category_tokens?.some(cat => cat.includes(categoryFilter))
      );
      console.log(`🔍 Category filter reduced voices from ${beforeFilter} to ${voices.length}`);
    }

    // Filter for English voices only for better quality
    const beforeLanguageFilter = voices.length;
    voices = voices.filter(v => 
      v.ietf_primary_language_subtag === 'en'
    );
    console.log(`🌐 Language filter reduced voices from ${beforeLanguageFilter} to ${voices.length}`);

    console.log(`✅ Returning ${voices.length} English voices`);

    return new Response(
      JSON.stringify({
        success: true,
        count: voices.length,
        voices: voices.map(v => ({
          voiceToken: v.model_token,
          title: v.title,
          creator: v.creator_display_name,
          botCommand: v.maybe_suggested_unique_bot_command,
          categories: v.category_tokens,
          language: v.ietf_language_tag,
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
    const response = await fetch(`${FAKEYOU_API_BASE}/tts/inference`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${FAKEYOU_API_BASE}/tts/job/${jobToken}`, {
      headers: {
        'Accept': 'application/json',
      },
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
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch audio: ${response.status}`);
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const audioData = await response.arrayBuffer();
    console.log(`✅ Audio fetched successfully (${audioData.byteLength} bytes)`);
    
    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/wav',
        'Content-Length': audioData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('💥 proxyAudio failed:', error);
    throw error;
  }
}

async function syncVoicesToDatabase(figureName?: string) {
  console.log('Syncing FakeYou voices to database...');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all voices
  const response = await fetch(`${FAKEYOU_API_BASE}/tts/list`);
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  let voices = data.models as FakeYouVoice[];

  // Filter for English voices only
  voices = voices.filter(v => v.ietf_primary_language_subtag === 'en');

  // If figureName provided, try to find matching voices
  if (figureName) {
    const searchTerm = figureName.toLowerCase();
    voices = voices.filter(v => 
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
          voice_id: voice.model_token,
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
