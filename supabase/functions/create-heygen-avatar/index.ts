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

    // Detect gender based on common patterns
    const femalePatterns = ['cleopatra', 'elizabeth', 'michelle', 'marie', 'rosa', 'joan', 'victoria', 'catherine', 'margaret'];
    const isFemale = femalePatterns.some(pattern => figureName.toLowerCase().includes(pattern));
    const targetGender = isFemale ? 'female' : 'male';

    console.log(`Detecting gender for "${figureName}": ${targetGender}`);

    // Step 1: Get available avatars
    const avatarsResponse = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': HEYGEN_API_KEY }
    });

    if (!avatarsResponse.ok) {
      throw new Error('Failed to fetch avatars');
    }

    const avatarsData = await avatarsResponse.json();
    const allAvatars = avatarsData.data?.avatars || [];
    console.log(`Found ${allAvatars.length} total avatars`);

    // Filter for public avatars with matching gender
    const matchingAvatars = allAvatars.filter((a: any) => {
      const avatarGender = a.gender?.toLowerCase();
      const isPublic = a.is_public === true;
      const genderMatch = avatarGender === targetGender;
      return isPublic && genderMatch;
    });

    console.log(`Found ${matchingAvatars.length} ${targetGender} public avatars`);

    if (matchingAvatars.length === 0) {
      throw new Error(`No ${targetGender} public avatars available`);
    }

    // Select the first matching avatar
    const avatar = matchingAvatars[0];

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
    const allVoices = voicesData.data?.voices || [];
    console.log(`Found ${allVoices.length} total voices`);

    // Filter for voices matching gender and language
    const matchingVoices = allVoices.filter((v: any) => {
      const voiceGender = v.gender?.toLowerCase();
      const language = v.language?.toLowerCase() || '';
      const isEnglish = language.includes('english') || language.includes('en-');
      const genderMatch = voiceGender === targetGender;
      return isEnglish && genderMatch;
    });

    console.log(`Found ${matchingVoices.length} ${targetGender} English voices`);

    if (matchingVoices.length === 0) {
      throw new Error(`No ${targetGender} English voices available`);
    }

    const voice = matchingVoices[0];

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

    console.log(`✅ Video generation started with ID: ${videoId}`);

    // Return video_id immediately for client-side polling
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        avatarId,
        status: 'processing',
        message: 'Video generation started. Poll /check-heygen-status to get the video URL.',
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

