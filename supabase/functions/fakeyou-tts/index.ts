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
  console.log('Fetching voices from FakeYou API...');
  
  const response = await fetch(`${FAKEYOU_API_BASE}/tts/list`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  
  let voices = data.models as FakeYouVoice[];
  
  // Filter by category if provided
  if (categoryFilter) {
    voices = voices.filter(v => 
      v.category_tokens?.some(cat => cat.includes(categoryFilter))
    );
  }

  // Filter for English voices only for better quality
  voices = voices.filter(v => 
    v.ietf_primary_language_subtag === 'en'
  );

  console.log(`Found ${voices.length} voices`);

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
}

async function generateTTS(text: string, voiceToken: string) {
  console.log(`Generating TTS with voice: ${voiceToken}`);
  
  // Generate a unique idempotency token
  const idempotencyToken = crypto.randomUUID();
  
  const response = await fetch(`${FAKEYOU_API_BASE}/tts/inference`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uuid_idempotency_token: idempotencyToken,
      tts_model_token: voiceToken,
      inference_text: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FakeYou TTS failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success || !data.inference_job_token) {
    throw new Error('Failed to start TTS job');
  }

  console.log(`TTS job started: ${data.inference_job_token}`);

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
}

async function checkJobStatus(jobToken: string) {
  console.log(`Checking status for job: ${jobToken}`);
  
  const response = await fetch(`${FAKEYOU_API_BASE}/tts/job/${jobToken}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check job status: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success || !data.state) {
    throw new Error('Invalid job status response');
  }

  const state = data.state;
  const status = state.status;
  
  // Construct audio URL if completed
  let audioUrl = null;
  if (status === 'complete_success' && state.maybe_public_bucket_wav_audio_path) {
    audioUrl = `${FAKEYOU_CDN_BASE}${state.maybe_public_bucket_wav_audio_path}`;
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
