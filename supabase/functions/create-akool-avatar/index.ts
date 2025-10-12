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
    const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
    const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY')?.trim();
    const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')?.trim();

    if (!AKOOL_API_KEY || !LOVABLE_API_KEY || !CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
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

    // Step 3: Save image to public Supabase storage bucket
    console.log('💾 Saving generated image to public storage...');
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `avatars/${figureId || figureName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Storage upload failed:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    console.log('✅ Image saved to storage:', publicUrl);

    // Step 3.5: Validate the URL is accessible
    console.log('🔍 Validating image URL accessibility...');
    let finalImageUrl = publicUrl;
    
    try {
      const headResponse = await fetch(publicUrl, { method: 'HEAD' });
      console.log('📊 URL validation response:', {
        status: headResponse.status,
        contentType: headResponse.headers.get('Content-Type'),
        contentLength: headResponse.headers.get('Content-Length'),
        url: publicUrl
      });

      if (!headResponse.ok) {
        console.error('❌ URL not accessible:', headResponse.status);
        throw new Error(`Image URL not accessible: ${headResponse.status}`);
      }

      const contentType = headResponse.headers.get('Content-Type');
      if (!contentType?.startsWith('image/')) {
        console.error('❌ Invalid content type:', contentType);
        throw new Error(`Invalid content type: ${contentType}`);
      }

      console.log('✅ URL validated successfully');
      
      // Upload to Cloudinary using proper API
      console.log('☁️ Uploading image to Cloudinary...');
      
      // Create Cloudinary signature for authenticated upload
      const timestamp = Math.round(Date.now() / 1000);
      const publicId = `avatars/${figureId || figureName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
      
      // Create signature string (must be in alphabetical order by key)
      const signatureString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
      
      // Generate SHA256 signature
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Prepare form data for Cloudinary upload
      const formData = new FormData();
      formData.append('file', new Blob([imageBuffer], { type: 'image/png' }));
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('public_id', publicId);
      
      const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
      const cloudinaryResponse = await fetch(cloudinaryUploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!cloudinaryResponse.ok) {
        const errorText = await cloudinaryResponse.text();
        console.error('❌ Cloudinary upload failed:', errorText);
        throw new Error(`Cloudinary upload failed: ${errorText}`);
      }
      
      const cloudinaryData = await cloudinaryResponse.json();
      finalImageUrl = cloudinaryData.secure_url;
      
      console.log('✅ Image uploaded to Cloudinary:', finalImageUrl);
      console.log('📌 Original Supabase URL:', publicUrl);
      
    } catch (validateError) {
      console.error('❌ URL validation failed:', validateError);
      const errorMsg = validateError instanceof Error ? validateError.message : String(validateError);
      throw new Error(`Image URL validation failed: ${errorMsg}`);
    }

    // Step 4: Create Akool talking avatar with CDN image URL
    console.log('🎭 Creating Akool talking avatar with CDN URL...');
    console.log('📤 Avatar URL being sent to Akool:', finalImageUrl);
    
    const akoolPayload = {
      width: 3840,
      height: 2160,
      avatar_from: 3, // Custom avatar
      elements: [
        {
          type: "avatar",
          url: finalImageUrl, // Use CDN URL
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
          voice_id: gender === 'female' ? '6889b628662160e2caad5dbc' : '6889b628662160e2caad5dbc'
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
    console.log('📥 Akool API response:', {
      status: akoolResponse.status,
      ok: akoolResponse.ok,
      code: akoolData.code,
      msg: akoolData.msg,
      urlSent: finalImageUrl,
      fullResponse: JSON.stringify(akoolData, null, 2)
    });

    if (!akoolResponse.ok || akoolData.code !== 1000) {
      console.error('❌ Akool API error details:', {
        httpStatus: akoolResponse.status,
        responseCode: akoolData.code,
        message: akoolData.msg,
        sentUrl: finalImageUrl,
        fullError: JSON.stringify(akoolData, null, 2)
      });
      throw new Error(`Akool API failed: ${akoolData.msg || 'Unknown error'}`);
    }

    // Step 3: Poll for video completion
    const taskId = akoolData.data?._id;
    if (!taskId) {
      throw new Error('No task ID returned from Akool');
    }

    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 120;

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
        taskId,
        visualPrompt
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
