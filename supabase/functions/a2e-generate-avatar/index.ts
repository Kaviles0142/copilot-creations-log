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

    console.log('🎬 Generating A2E avatar video');

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
    
    // Step 2: Get list of available avatars to find a valid anchor_id
    console.log('Step 2: Fetching available avatars...');
    const avatarsResponse = await fetch(`${BASE_URL}/api/v1/anchor/character_list?type=0`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
      },
    });

    if (!avatarsResponse.ok) {
      const error = await avatarsResponse.text();
      console.error('❌ Failed to fetch avatars:', error);
      throw new Error(`Failed to fetch avatars: ${error}`);
    }

    const avatarsData = await avatarsResponse.json();
    
    // Use the first available public avatar
    const firstAvatar = avatarsData.data?.[0];
    if (!firstAvatar || !firstAvatar._id) {
      throw new Error('No public avatars available');
    }
    
    const anchorId = firstAvatar._id;
    console.log('✅ Using avatar:', firstAvatar.name || 'Unknown', 'ID:', anchorId);
    
    // Step 3: Start video generation
    console.log('Step 3: Generating video with A2E...');
    const generateVideoResponse = await fetch(`${BASE_URL}/api/v1/video/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `${figureName} Avatar`,
        anchor_id: anchorId,
        anchor_type: 0,
        audioSrc: publicAudioUrl,
        web_bg_width: 0,
        web_bg_height: 0,
        web_people_width: 0,
        web_people_height: 0,
        web_people_x: 0,
        web_people_y: 0,
        isSkipRs: true,
      }),
    });

    if (!generateVideoResponse.ok) {
      const error = await generateVideoResponse.text();
      console.error('❌ Video generation failed:', error);
      throw new Error(`Video generation failed: ${error}`);
    }

    const videoData = await generateVideoResponse.json();
    const taskId = videoData.data?._id || videoData._id;
    console.log('✅ Video generation started, task ID:', taskId);

    // Step 4: Poll for completion
    console.log('Step 4: Polling for video completion...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let videoUrl = null;

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${BASE_URL}/api/v1/video/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${A2E_API_KEY}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log(`📊 Status check ${attempts + 1}: ${statusData.status || 'processing'}`);
        
        if (statusData.status === 'completed' && statusData.videoUrl) {
          videoUrl = statusData.videoUrl;
          console.log('✅ Video ready:', videoUrl);
        } else if (statusData.status === 'failed') {
          throw new Error('Video generation failed');
        }
      }
      
      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out');
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
