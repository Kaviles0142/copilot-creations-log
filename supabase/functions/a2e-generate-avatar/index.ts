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
    console.log('📸 Image URL:', imageUrl);
    console.log('🎤 Audio URL:', audioUrl);

    // Use A2E's public avatar system - no need to create custom avatars
    // We'll use a public avatar ID and the provided audio
    const BASE_URL = 'https://video.a2e.ai';
    
    console.log('Step 1: Generating video with public avatar...');
    const generateVideoResponse = await fetch(`${BASE_URL}/api/v1/video/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `${figureName} Avatar`,
        anchor_id: 'default', // Use a default/public avatar for now
        anchor_type: 0, // 0 = system provided
        audioSrc: audioUrl,
        web_bg_width: 0, // No background matting
        web_bg_height: 0,
        web_people_width: 0,
        web_people_height: 0,
        web_people_x: 0,
        web_people_y: 0,
        isSkipRs: true, // Skip smart motion for faster generation
      }),
    });

    if (!generateVideoResponse.ok) {
      const error = await generateVideoResponse.text();
      console.error('❌ Video generation failed:', error);
      throw new Error(`Video generation failed: ${error}`);
    }

    const videoData = await generateVideoResponse.json();
    console.log('✅ Video generation started:', videoData);

    // Note: A2E returns a task ID, need to poll for completion
    // For now, return the task info
    return new Response(
      JSON.stringify({
        success: true,
        taskId: videoData.data?._id || videoData._id,
        message: 'Video generation started',
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
