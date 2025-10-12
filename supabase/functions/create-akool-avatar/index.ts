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
    const { figureName, text, figureId, audioUrl } = await req.json();
    console.log('🎬 Creating Akool avatar for:', figureName);
    console.log('🎤 Audio URL provided:', !!audioUrl);
    console.log('📝 Text provided:', text?.substring(0, 100));

    const AKOOL_API_KEY = Deno.env.get('AKOOL_API_KEY')?.trim();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')?.trim();

    if (!AKOOL_API_KEY || !LOVABLE_API_KEY) {
      throw new Error('Missing required API keys');
    }

    console.log('🔑 API keys loaded and validated');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Helper function to detect likely gender from name
    const detectGender = (name: string): 'male' | 'female' => {
      const nameLower = name.toLowerCase();
      const femaleIndicators = ['cleopatra', 'queen', 'empress', 'marie', 'elizabeth', 'victoria', 'catherine', 'joan', 'rosa', 'harriet', 'susan', 'amelia', 'florence', 'ada', 'jane', 'mary', 'anne', 'margaret', 'eleanor'];
      const isFemale = femaleIndicators.some(indicator => nameLower.includes(indicator));
      return isFemale ? 'female' : 'male';
    };

    const gender = detectGender(figureName);

    const generateVisualPrompt = async (): Promise<string> => {
      console.log('🎨 Generating visual prompt...');
      
      const styleInstruction = `Create a detailed visual description for generating a peaceful, dignified portrait of ${figureName}. Include:
1. Calm, wise facial expression showing intelligence and composure
2. Era-appropriate formal attire (NO weapons, armor, or military gear)
3. Neutral, scholarly background setting (library, study, or formal portrait setting)
4. Dignified posture suggesting leadership and wisdom
5. Photorealistic portrait style with soft, flattering lighting
6. Emphasize peaceful, diplomatic qualities rather than conflict or aggression`;

      const visualPromptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating detailed, historically accurate visual descriptions for AI image generation. Focus on physical appearance, era-appropriate clothing, setting, and expression.'
            },
            {
              role: 'user',
              content: styleInstruction + '\n\nKeep it concise but vivid. Make it suitable for AI image generation.'
            }
          ],
          max_tokens: 500,
        }),
      });

      if (!visualPromptResponse.ok) {
        throw new Error('Failed to generate visual prompt');
      }

      const visualPromptData = await visualPromptResponse.json();
      const visualPrompt = visualPromptData.choices[0].message.content;
      console.log('✅ Generated visual prompt:', visualPrompt.substring(0, 100) + '...');
      return visualPrompt;
    };

    // Step 1: Generate visual prompt
    const visualPrompt = await generateVisualPrompt();

    // Step 2: Generate image using Lovable AI's image generation model
    console.log('🎨 Generating portrait image...');
    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate a photorealistic portrait: ${visualPrompt}`
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('Image generation failed:', errorText);
      throw new Error('Failed to generate portrait image');
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) {
      throw new Error('No image generated');
    }

    console.log('✅ Portrait image generated');

    // Step 3: Upload image to Supabase storage
    console.log('📤 Uploading image to storage...');
    
    // Convert base64 to blob
    const base64Data = base64Image.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `akool-avatars/${figureId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, bytes, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: 'public, max-age=31536000'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image: ' + uploadError.message);
    }

    // Get download URL (not just public URL - this forces download headers)
    const { data } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName, {
        download: false // We want it viewable, not forced download
      });

    const imageUrl = data.publicUrl;
    console.log('✅ Image uploaded, URL:', imageUrl);

    // Step 4: Create Akool talking avatar using correct API structure
    console.log('🎭 Creating Akool talking avatar...');
    
    const akoolPayload = {
      width: 3840,
      height: 2160,
      avatar_from: 3, // Using custom avatar URL
      elements: [
        {
          type: "avatar",
          url: imageUrl,
          scale_x: 1,
          scale_y: 1,
          width: 1080,
          height: 1080,
          offset_x: 1920,
          offset_y: 1080
        },
        {
          type: "audio",
          input_text: text || `Hello, I am ${figureName}`,
          voice_id: gender === 'female' ? '6889b628662160e2caad5dbc' : '6889b628662160e2caad5dbc' // Default voice IDs
        }
      ]
    };

    console.log('📤 Sending request to Akool with payload:', JSON.stringify(akoolPayload, null, 2));

    const akoolResponse = await fetch('https://openapi.akool.com/api/open/v3/talkingavatar/create', {
      method: 'POST',
      headers: {
        'x-api-key': AKOOL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(akoolPayload)
    });

    const akoolData = await akoolResponse.json();
    console.log('✅ Akool response:', JSON.stringify(akoolData, null, 2));

    if (!akoolResponse.ok || akoolData.code !== 1000) {
      console.error('❌ Akool API error:', akoolResponse.status, akoolData);
      throw new Error(`Akool API failed: ${akoolData.msg || 'Unknown error'}`);
    }

    // Step 5: Poll for video completion
    const taskId = akoolData.data?._id;
    if (!taskId) {
      throw new Error('No task ID returned from Akool');
    }

    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max (Akool can take longer)

    console.log('⏳ Waiting for video generation...');
    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://openapi.akool.com/api/open/v3/content/video/infobymodelid?video_model_id=${taskId}`, {
        headers: {
          'x-api-key': AKOOL_API_KEY,
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (statusData.data?.video_status === 3) {
          videoUrl = statusData.data?.video;
          console.log('✅ Video ready!');
        } else if (statusData.data?.video_status === 4) {
          console.error('❌ Akool generation error:', statusData);
          throw new Error('Akool video generation failed');
        } else {
          console.log(`⏳ Status: ${statusData.data?.video_status} (attempt ${attempts + 1}/${maxAttempts})`);
        }
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Video generation timeout after 2 minutes');
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        visualPrompt,
        taskId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating Akool avatar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
