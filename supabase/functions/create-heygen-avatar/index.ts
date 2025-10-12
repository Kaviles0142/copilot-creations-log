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
    const { text, figureName } = await req.json();

    if (!text || !figureName) {
      throw new Error('Text and figure name are required');
    }

    const HEYGEN_API_KEY = Deno.env.get('HEYGEN_API_KEY');
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    console.log(`🎬 Creating HeyGen video for ${figureName}`);

    // Detect gender
    const isFemale = figureName.toLowerCase().includes('cleopatra') || 
                     figureName.toLowerCase().includes('elizabeth') || 
                     figureName.toLowerCase().includes('michelle');

    // Step 1: Get available avatars
    const avatarsResponse = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': HEYGEN_API_KEY }
    });

    if (!avatarsResponse.ok) {
      throw new Error('Failed to fetch avatars');
    }

    const avatarsData = await avatarsResponse.json();
    console.log(`Found ${avatarsData.data?.avatars?.length || 0} avatars`);

    // Find a suitable public avatar
    const avatars = avatarsData.data?.avatars || [];
    const avatar = avatars.find((a: any) => 
      a.gender?.toLowerCase() === (isFemale ? 'female' : 'male') && 
      a.is_public === true
    ) || avatars[0];

    if (!avatar) {
      throw new Error('No avatars available');
    }

    // Step 2: Get available voices
    const voicesResponse = await fetch('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': HEYGEN_API_KEY }
    });

    if (!voicesResponse.ok) {
      throw new Error('Failed to fetch voices');
    }

    const voicesData = await voicesResponse.json();
    console.log(`Found ${voicesData.data?.voices?.length || 0} voices`);

    // Find a suitable voice (English, matching gender)
    const voices = voicesData.data?.voices || [];
    const voice = voices.find((v: any) => 
      v.language?.toLowerCase().includes('english') && 
      v.gender?.toLowerCase() === (isFemale ? 'female' : 'male')
    ) || voices[0];

    if (!voice) {
      throw new Error('No voices available');
    }

    const avatarId = avatar.avatar_id;
    const voiceId = voice.voice_id;

    console.log(`🎭 Using avatar: ${avatarId} (${avatar.avatar_name})`);
    console.log(`🎤 Using voice: ${voiceId} (${voice.name})`);

    // Create talking avatar video using HeyGen v2 API
    const videoResponse = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: text,
              voice_id: voiceId,
            },
          }
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
        aspect_ratio: '16:9',
      })
    });

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error('Video generation failed:', errorText);
      throw new Error(`Video generation failed: ${errorText}`);
    }

    const videoData = await videoResponse.json();
    console.log('Video generation initiated:', videoData);

    const videoId = videoData.data?.video_id;
    if (!videoId) {
      throw new Error('No video ID returned from video generation');
    }

    // Poll for video completion (max 2 minutes)
    console.log('⏳ Waiting for video to be generated');
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const videoStatusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
        }
      });

      const videoStatusData = await videoStatusResponse.json();
      console.log(`Video status check ${attempts}:`, videoStatusData.data?.status);

      if (videoStatusData.data?.status === 'completed') {
        videoUrl = videoStatusData.data?.video_url;
        console.log('✅ Video generated:', videoUrl);
        break;
      } else if (videoStatusData.data?.status === 'failed') {
        throw new Error('Video generation failed');
      }
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out');
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        avatarId,
        duration: attempts * 2,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-heygen-avatar:', error);
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

