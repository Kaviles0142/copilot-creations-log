import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, audioUrl, figureName } = await req.json();
    const A2E_API_KEY = Deno.env.get('A2E_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!A2E_API_KEY) {
      throw new Error('A2E_API_KEY not configured');
    }

    console.log('🎬 Generating Talking Photo with A2E');

    // Step 1: Upload audio to Supabase storage if it's a data URL
    let publicAudioUrl = audioUrl;
    
    if (audioUrl.startsWith('data:')) {
      console.log('📤 Uploading audio to storage...');
      
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Convert base64 to blob
      const base64Data = audioUrl.split(',')[1];
      const audioBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Upload to storage
      const fileName = `a2e-audio-${Date.now()}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Audio upload failed:', uploadError);
        throw new Error('Failed to upload audio to storage');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);
      
      publicAudioUrl = publicUrl;
      console.log('✅ Audio uploaded:', publicAudioUrl);
    }

    console.log('🎤 Using audio URL:', publicAudioUrl);

    const BASE_URL = 'https://video.a2e.ai';
    
    // Step 2: Start Talking Video generation
    console.log('Step 2: Starting Talking Video generation...');
    const startResponse = await fetch(`${BASE_URL}/api/v1/talkingVideo/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${figureName} Talking Video`,
        image_url: imageUrl,
        audio_url: publicAudioUrl,
        prompt: "speaking, looking at the camera, detailed eyes, clear teeth, natural head movement, elegant, clear facial features, professional lighting",
        negative_prompt: "vivid colors, overexposed, flickering, blurry details, subtitles, logo, worst quality, low quality, static, motionless"
      }),
    });

    if (!startResponse.ok) {
      const error = await startResponse.text();
      console.error('❌ Talking Video start failed:', error);
      throw new Error(`Talking Video start failed: ${error}`);
    }

    const startData = await startResponse.json();
    console.log('📋 Start response:', JSON.stringify(startData));
    
    // Try multiple possible response structures
    const taskId = startData.data?.id || startData.data?.task_id || startData.id || startData.task_id || startData.data?._id;
    
    if (!taskId) {
      console.error('❌ No task ID found in response:', JSON.stringify(startData));
      throw new Error('Failed to get task ID from A2E API');
    }
    
    console.log('✅ Talking Video task started, ID:', taskId);

    // Step 3: Poll for completion
    console.log('Step 3: Polling for completion...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    let videoUrl = null;

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${BASE_URL}/api/v1/talkingVideo/detail/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${A2E_API_KEY}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log(`📊 Status check ${attempts + 1}:`, JSON.stringify(statusData));
        
        const status = statusData.data?.status || statusData.status;
        const result = statusData.data?.result || statusData.result || statusData.data?.video_url || statusData.video_url;
        
        if (status === 'completed' || status === 'success' || status === 'done') {
          if (result) {
            videoUrl = result;
            console.log('✅ Video ready:', videoUrl);
          } else {
            console.error('❌ Status is completed but no result URL found:', JSON.stringify(statusData));
          }
        } else if (status === 'failed' || status === 'error') {
          const errorMsg = statusData.data?.error || statusData.error || 'Unknown error';
          console.error('❌ Generation failed:', errorMsg);
          throw new Error(`Talking Photo generation failed: ${errorMsg}`);
        }
      } else {
        console.error(`❌ Status check failed with status ${statusResponse.status}`);
      }
      
      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Talking Video generation timed out');
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: videoUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in a2e-generate-avatar:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate avatar video',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
