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
    const { imageUrl, audioUrl, figureName } = await req.json();
    const A2E_API_KEY = Deno.env.get('A2E_API_KEY');

    if (!A2E_API_KEY) {
      throw new Error('A2E_API_KEY not configured');
    }

    console.log('🎬 Generating A2E avatar video');
    console.log('🎤 Audio URL:', audioUrl);

    const BASE_URL = 'https://video.a2e.ai';
    
    // Step 1: Start video generation
    console.log('Step 1: Generating video with public avatar...');
    const generateVideoResponse = await fetch(`${BASE_URL}/api/v1/video/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `${figureName} Avatar`,
        anchor_id: 'default',
        anchor_type: 0,
        audioSrc: audioUrl,
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

    // Step 2: Poll for completion
    console.log('Step 2: Polling for video completion...');
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
