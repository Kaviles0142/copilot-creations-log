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
    
    // Step 2: Start Talking Photo generation
    console.log('Step 2: Starting Talking Photo generation...');
    const startResponse = await fetch(`${BASE_URL}/api/v1/talkingPhoto/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${figureName} Talking Avatar`,
        image_url: imageUrl,
        audio_url: publicAudioUrl,
        duration: 10,
        prompt: "speaking, looking at the camera, detailed eyes, clear teeth, static view point, still background, elegant, clear facial features, stable camera, professional shooting angle",
        negative_prompt: "vivid colors, overexposed, flickering, blurry details, subtitles, logo, style, artwork, painting, image, static, overall grayish, worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, motionless person, cluttered background, three legs, crowded background, walking backwards"
      }),
    });

    if (!startResponse.ok) {
      const error = await startResponse.text();
      console.error('❌ Talking Photo start failed:', error);
      throw new Error(`Talking Photo start failed: ${error}`);
    }

    const startData = await startResponse.json();
    console.log('📋 Start response:', JSON.stringify(startData));
    
    // Try multiple possible response structures
    const taskId = startData.data?.id || startData.data?.task_id || startData.id || startData.task_id || startData.data?._id;
    
    if (!taskId) {
      console.error('❌ No task ID found in response:', JSON.stringify(startData));
      throw new Error('Failed to get task ID from A2E API');
    }
    
    console.log('✅ Talking Photo task started, ID:', taskId);

    // Step 3: Poll for completion
    console.log('Step 3: Polling for completion...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    let videoUrl = null;

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Try the direct endpoint without /detail
      const statusResponse = await fetch(`${BASE_URL}/api/v1/talkingPhoto/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${A2E_API_KEY}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log(`📊 Status check ${attempts + 1}:`, JSON.stringify(statusData));
        
        // A2E uses data.current_status for status
        const status = statusData.data?.current_status || statusData.current_status;
        
        if (status === 'completed' || status === 'success' || status === 'done') {
          // Log the COMPLETE response structure
          console.log('🔍 FULL COMPLETION RESPONSE:', JSON.stringify(statusData, null, 2));
          
          // A2E uses data.result_url for the final video
          const resultUrl = statusData.data?.result_url || statusData.result_url;
          
          if (resultUrl) {
            videoUrl = resultUrl;
            console.log('✅ Video URL found:', videoUrl);
            console.log('✅ URL type check - contains .mp4:', videoUrl.includes('.mp4'));
          } else {
            console.error('❌ Status is completed but result_url is empty');
            console.error('❌ Full data object:', JSON.stringify(statusData.data, null, 2));
          }
        } else if (status === 'failed' || status === 'error') {
          const errorMsg = statusData.data?.failed_message || statusData.failed_message || 'Unknown error';
          console.error('❌ Generation failed:', errorMsg);
          throw new Error(`Talking Photo generation failed: ${errorMsg}`);
        } else {
          // Still processing
          console.log(`⏳ Status: ${status}, waiting...`);
        }
      } else {
        const errorText = await statusResponse.text();
        console.error(`❌ Status check failed with status ${statusResponse.status}:`, errorText);
      }
      
      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Talking Photo generation timed out');
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
