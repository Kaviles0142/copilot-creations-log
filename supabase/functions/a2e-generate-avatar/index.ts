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

    // Step 1: Create avatar from image
    console.log('Step 1: Creating avatar...');
    const createAvatarResponse = await fetch('https://api.a2e.ai/v1/avatars/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        name: figureName || 'Historical Figure',
      }),
    });

    if (!createAvatarResponse.ok) {
      const error = await createAvatarResponse.text();
      console.error('❌ Avatar creation failed:', error);
      throw new Error(`Avatar creation failed: ${error}`);
    }

    const avatarData = await createAvatarResponse.json();
    const avatarId = avatarData.avatar_id;
    console.log('✅ Avatar created:', avatarId);

    // Step 2: Generate video with avatar and audio
    console.log('Step 2: Generating video...');
    const generateVideoResponse = await fetch('https://api.a2e.ai/v1/videos/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatarId,
        audio_url: audioUrl,
        quality: 'high',
      }),
    });

    if (!generateVideoResponse.ok) {
      const error = await generateVideoResponse.text();
      console.error('❌ Video generation failed:', error);
      throw new Error(`Video generation failed: ${error}`);
    }

    const videoData = await generateVideoResponse.json();
    console.log('✅ Video generated:', videoData.video_url);

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: videoData.video_url,
        avatarId: avatarId,
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
