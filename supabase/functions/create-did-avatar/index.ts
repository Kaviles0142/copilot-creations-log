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
    console.log('🎬 Creating D-ID avatar for:', figureName);
    console.log('🎤 Audio URL provided:', !!audioUrl);

    const DID_API_KEY = Deno.env.get('DID_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!DID_API_KEY || !LOVABLE_API_KEY) {
      throw new Error('Missing required API keys');
    }

    // Step 1: Generate detailed visual prompt using Lovable AI
    console.log('🎨 Generating visual prompt...');
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
            content: `Create a detailed visual description for generating a portrait of ${figureName}. Include:
1. Physical appearance (face, hair, age, distinctive features)
2. Era-appropriate clothing and accessories
3. Background setting (should be relevant to their time/location)
4. Facial expression and posture
5. Photorealistic portrait style

Keep it concise but vivid. Make it suitable for AI image generation.`
          }
        ]
      })
    });

    if (!visualPromptResponse.ok) {
      const errorText = await visualPromptResponse.text();
      console.error('Visual prompt generation failed:', errorText);
      throw new Error('Failed to generate visual prompt');
    }

    const visualData = await visualPromptResponse.json();
    const visualPrompt = visualData.choices[0].message.content;
    console.log('✅ Generated visual prompt:', visualPrompt.substring(0, 100) + '...');

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Convert base64 to blob
    const base64Data = base64Image.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `${figureId}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, bytes, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded:', publicUrl);
    const imageUrl = publicUrl;
    
    console.log('✅ Image ready for D-ID');

    // Step 3: Create D-ID talking avatar with audio or text
    console.log('🎭 Creating D-ID talking avatar...');
    
    const didPayload: any = {
      source_url: imageUrl,
      config: {
        stitch: true,
        result_format: 'mp4'
      }
    };

    // If audio URL is provided, use it; otherwise fall back to text-to-speech
    if (audioUrl) {
      console.log('🎤 Using provided audio URL');
      didPayload.script = {
        type: 'audio',
        audio_url: audioUrl
      };
    } else {
      console.log('📝 Using text-to-speech fallback');
      didPayload.script = {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: 'en-US-JennyNeural'
        }
      };
    }

    console.log('📤 Sending request to D-ID with payload:', JSON.stringify(didPayload, null, 2));

    let didResponse;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        didResponse = await fetch('https://api.d-id.com/talks', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${DID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(didPayload)
        });

        if (didResponse.ok) {
          break; // Success, exit retry loop
        }

        const errorText = await didResponse.text();
        console.error(`❌ D-ID API error (attempt ${retryCount + 1}/${maxRetries + 1}):`, errorText);
        
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          throw new Error(`D-ID API failed after ${maxRetries + 1} attempts: ${didResponse.status} - ${errorText}`);
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          console.log(`⏳ Network error, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    if (!didResponse || !didResponse.ok) {
      throw new Error('Failed to create D-ID avatar after retries');
    }

    const didData = await didResponse.json();
    console.log('✅ D-ID talk created:', didData.id);

    // Step 3: Poll for video completion
    const talkId = didData.id;
    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    console.log('⏳ Waiting for video generation...');
    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'done') {
          videoUrl = statusData.result_url;
          console.log('✅ Video ready!');
        } else if (statusData.status === 'error') {
          console.error('❌ D-ID generation error:', statusData);
          throw new Error('D-ID video generation failed');
        } else {
          console.log(`⏳ Status: ${statusData.status} (attempt ${attempts + 1}/${maxAttempts})`);
        }
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Video generation timeout after 60 seconds');
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        visualPrompt,
        talkId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating D-ID avatar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
