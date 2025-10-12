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
    const { text, figureName, voiceId } = await req.json();
    console.log('📝 Creating Akool avatar for:', figureName);

    const AKOOL_API_KEY = Deno.env.get('AKOOL_API_KEY');
    if (!AKOOL_API_KEY) {
      throw new Error('AKOOL_API_KEY not configured');
    }

    const headers = {
      'x-api-key': AKOOL_API_KEY,
      'Content-Type': 'application/json',
    };

    // Step 1: Get list of available avatars
    console.log('🎭 Fetching available avatars...');
    const avatarListResponse = await fetch(
      'https://openapi.akool.com/api/open/v3/avatar/list?from=2&page=1&size=100',
      { headers }
    );

    if (!avatarListResponse.ok) {
      const error = await avatarListResponse.text();
      console.error('❌ Failed to get avatar list:', error);
      throw new Error('Failed to get avatar list');
    }

    const avatarListData = await avatarListResponse.json();
    console.log('✅ Got avatar list:', avatarListData.data?.length, 'avatars');

    // Select a random avatar (or you could implement logic to match figure characteristics)
    const avatars = avatarListData.data || [];
    const selectedAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    
    if (!selectedAvatar) {
      throw new Error('No avatars available');
    }

    console.log('👤 Selected avatar:', selectedAvatar.name);

    // Step 2: Get list of available voices
    console.log('🎤 Fetching available voices...');
    const voiceListResponse = await fetch(
      'https://openapi.akool.com/api/open/v3/voice/list?page=1&size=100',
      { headers }
    );

    if (!voiceListResponse.ok) {
      const error = await voiceListResponse.text();
      console.error('❌ Failed to get voice list:', error);
      throw new Error('Failed to get voice list');
    }

    const voiceListData = await voiceListResponse.json();
    console.log('✅ Got voice list:', voiceListData.data?.length, 'voices');

    // Select a voice (use provided voiceId or pick randomly)
    const voices = voiceListData.data || [];
    const selectedVoice = voiceId 
      ? voices.find((v: any) => v.voice_id === voiceId) 
      : voices[Math.floor(Math.random() * voices.length)];

    if (!selectedVoice) {
      throw new Error('No voices available');
    }

    console.log('🎵 Selected voice:', selectedVoice.voice_id);

    // Step 3: Create talking avatar
    console.log('🎬 Creating talking avatar video...');
    const createAvatarPayload = {
      width: 3840,
      height: 2160,
      avatar_from: selectedAvatar.from,
      elements: [
        {
          type: "avatar",
          avatar_id: selectedAvatar.avatar_id,
          scale_x: 1,
          scale_y: 1,
          width: 1080,
          height: 1080,
          offset_x: 1920,
          offset_y: 1080
        },
        {
          type: "audio",
          input_text: text,
          voice_id: selectedVoice.voice_id
        }
      ]
    };

    console.log('📦 Payload:', JSON.stringify(createAvatarPayload, null, 2));

    const createResponse = await fetch(
      'https://openapi.akool.com/api/open/v3/talkingavatar/create',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(createAvatarPayload)
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ Failed to create avatar:', error);
      throw new Error(`Failed to create avatar: ${error}`);
    }

    const createData = await createResponse.json();
    console.log('✅ Avatar creation response:', createData);

    const videoId = createData.data?._id;
    if (!videoId) {
      throw new Error('No video ID returned from Akool');
    }

    // Step 4: Poll for completion
    console.log('⏳ Polling for video completion...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(
        `https://openapi.akool.com/api/open/v3/talkingavatar/${videoId}`,
        { headers }
      );

      if (!statusResponse.ok) {
        console.error('❌ Failed to check status');
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`📊 Status check ${attempts + 1}:`, statusData.data?.video_status);

      const status = statusData.data?.video_status;
      
      if (status === 3) { // completed
        console.log('✅ Video completed!');
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: statusData.data.video,
            videoId: videoId,
            avatarName: selectedAvatar.name,
            voiceId: selectedVoice.voice_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (status === 4) { // failed
        console.error('❌ Video generation failed');
        throw new Error('Video generation failed');
      }
      
      attempts++;
    }

    throw new Error('Video generation timeout - took longer than 5 minutes');

  } catch (error) {
    console.error('❌ Error in create-akool-avatar:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
