import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, figureName, figureId } = await req.json();
    console.log('📝 Creating Akool avatar for:', figureName);

    const AKOOL_API_KEY = Deno.env.get('AKOOL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!AKOOL_API_KEY) throw new Error('AKOOL_API_KEY not configured');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const headers = {
      'x-api-key': AKOOL_API_KEY,
      'Content-Type': 'application/json',
    };

    // Helper to detect gender from name
    const detectGender = (name: string): 'male' | 'female' => {
      const femaleTitles = ['queen', 'empress', 'princess', 'lady', 'mrs', 'ms', 'miss'];
      const femaleNames = ['marie', 'rosa', 'ada', 'florence', 'helen', 'amelia', 'harriet', 
                          'eleanor', 'cleopatra', 'joan', 'elizabeth', 'victoria', 'catherine'];
      const nameLower = name.toLowerCase();
      
      if (femaleTitles.some(title => nameLower.includes(title))) return 'female';
      if (femaleNames.some(fn => nameLower.includes(fn))) return 'female';
      return 'male';
    };

    // Step 1: Generate portrait using Lovable AI
    console.log('🎨 Generating portrait for:', figureName);
    const gender = detectGender(figureName);
    
    const visualPrompt = `Create a highly realistic portrait photograph of ${figureName}, the historical figure. 
Professional studio portrait with era-appropriate clothing and background from their time period.
${gender === 'female' ? 'Female historical figure' : 'Male historical figure'}.
Photorealistic, high quality, dignified expression, looking directly at camera.
Ultra high resolution, detailed facial features, historically accurate appearance.`;

    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{
          role: 'user',
          content: visualPrompt
        }],
        modalities: ['image', 'text']
      })
    });

    if (!imageResponse.ok) {
      const error = await imageResponse.text();
      console.error('❌ Image generation failed:', error);
      throw new Error('Failed to generate portrait');
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) {
      throw new Error('No image generated');
    }

    console.log('✅ Portrait generated');

    // Keep base64 image for Akool (don't rely on URL)
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    // Still upload to storage for reference, but we'll use base64 for Akool
    console.log('📤 Uploading portrait to storage for reference...');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${figureId || figureName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(`avatars/${fileName}`, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.warn('⚠️ Upload failed (non-critical):', uploadError);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(`avatars/${fileName}`);

    console.log('✅ Portrait uploaded:', publicUrl);

    // Step 3: Get voice list
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

    // Select gender-appropriate voice
    const voices = voiceListData.data || [];
    const genderVoices = voices.filter((v: any) => 
      gender === 'female' 
        ? v.name?.toLowerCase().includes('female') || v.gender?.toLowerCase() === 'female'
        : v.name?.toLowerCase().includes('male') || v.gender?.toLowerCase() === 'male'
    );
    
    const selectedVoice = genderVoices.length > 0 
      ? genderVoices[Math.floor(Math.random() * genderVoices.length)]
      : voices[0];

    if (!selectedVoice) {
      throw new Error('No voices available');
    }

    console.log('🎵 Selected voice:', selectedVoice.name || selectedVoice.voice_id);

    // Step 4: Create talking avatar with custom image (use base64 data URL)
    console.log('🎬 Creating talking avatar video...');
    const createAvatarPayload = {
      width: 3840,
      height: 2160,
      avatar_from: 3, // 3 = custom avatar URL
      elements: [
        {
          type: "avatar",
          url: base64Image, // Use base64 data URL instead of storage URL
          scale_x: 1,
          scale_y: 1,
          width: 1920,
          height: 2160,
          offset_x: 960,
          offset_y: 0
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

    // Check for Akool error codes
    if (createData.code !== 1000) {
      console.error('❌ Akool API error:', createData);
      throw new Error(`Akool API error (${createData.code}): ${createData.msg || 'Unknown error'}`);
    }

    const videoId = createData.data?._id;
    if (!videoId) {
      console.error('❌ No video ID in response:', createData);
      throw new Error('No video ID returned from Akool');
    }

    // Step 5: Poll for completion
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
            portraitUrl: publicUrl,
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
