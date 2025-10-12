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
    const { text, figureName, description, voiceId = "en-US-GuyNeural" } = await req.json();

    if (!text || !figureName) {
      throw new Error('Text and figure name are required');
    }

    const HEYGEN_API_KEY = Deno.env.get('HEYGEN_API_KEY');
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    console.log(`🎬 Creating HeyGen avatar for ${figureName}`);

    // Step 1: Generate AI avatar photo from description
    console.log('📸 Step 1: Generating AI avatar photo from description');
    const avatarPhotoResponse = await fetch('https://api.heygen.com/v1/avatar.generate_ai_avatar_photos', {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: description || `A distinguished historical figure resembling ${figureName}, portrait style, professional, era-appropriate attire`,
        num_images: 1,
        style: 'realistic'
      })
    });

    if (!avatarPhotoResponse.ok) {
      const errorText = await avatarPhotoResponse.text();
      console.error('Avatar photo generation failed:', errorText);
      throw new Error(`Avatar photo generation failed: ${errorText}`);
    }

    const avatarPhotoData = await avatarPhotoResponse.json();
    console.log('Avatar photo generation initiated:', avatarPhotoData);

    // The API returns a job ID, we need to poll for completion
    const jobId = avatarPhotoData.data?.job_id;
    if (!jobId) {
      throw new Error('No job ID returned from avatar photo generation');
    }

    // Step 2: Poll for avatar photo completion (max 60 seconds)
    console.log('⏳ Step 2: Waiting for avatar photo to be generated');
    let avatarImageUrl = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max

    while (!avatarImageUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      const statusResponse = await fetch(`https://api.heygen.com/v1/avatar.generate_ai_avatar_photos/${jobId}`, {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
        }
      });

      const statusData = await statusResponse.json();
      console.log(`Status check ${attempts}:`, statusData);

      if (statusData.data?.status === 'completed') {
        avatarImageUrl = statusData.data?.images?.[0]?.url;
        console.log('✅ Avatar photo generated:', avatarImageUrl);
        break;
      } else if (statusData.data?.status === 'failed') {
        throw new Error('Avatar photo generation failed');
      }
    }

    if (!avatarImageUrl) {
      throw new Error('Avatar photo generation timed out');
    }

    // Step 3: Create talking avatar video with the generated image
    console.log('🎥 Step 3: Creating talking avatar video');
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
              avatar_id: 'custom', // Using custom image
              avatar_image: avatarImageUrl,
            },
            voice: {
              type: 'text',
              input_text: text,
              voice_id: voiceId,
            },
          }
        ],
        dimension: {
          width: 1920,
          height: 1080,
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

    const videoJobId = videoData.data?.video_id;
    if (!videoJobId) {
      throw new Error('No video ID returned from video generation');
    }

    // Step 4: Poll for video completion (max 3 minutes)
    console.log('⏳ Step 4: Waiting for video to be generated');
    let videoUrl = null;
    let videoAttempts = 0;
    const maxVideoAttempts = 90; // 90 attempts * 2 seconds = 3 minutes max

    while (!videoUrl && videoAttempts < maxVideoAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      videoAttempts++;

      const videoStatusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoJobId}`, {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
        }
      });

      const videoStatusData = await videoStatusResponse.json();
      console.log(`Video status check ${videoAttempts}:`, videoStatusData);

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
        avatarImageUrl,
        duration: videoAttempts * 2,
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
