// Akool Avatar Creation Edge Function - Updated to use correct API endpoint
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

    // Check if we have a cached image for this figure
    console.log('🔍 Checking for cached avatar image...');
    const { data: cachedImage } = await supabase
      .from('avatar_image_cache')
      .select('*')
      .eq('figure_id', figureId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    let finalImageUrl: string;
    let visualPrompt: string;

    if (cachedImage) {
      console.log('✅ Using cached image:', cachedImage.cloudinary_url);
      finalImageUrl = cachedImage.cloudinary_url;
      visualPrompt = cachedImage.visual_prompt || '';
    } else {
      console.log('🎨 No cached image found, generating new one...');
      
      // Step 1: Generate visual prompt
      visualPrompt = await generateVisualPrompt();

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

      // Step 3.5: Validate the URL is accessible and upload to Cloudinary
      console.log('🔍 Validating image URL accessibility...');
      
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
        
        // Upload to Cloudinary
        console.log('☁️ Uploading image to Cloudinary...');
        
        const timestamp = Math.round(Date.now() / 1000);
        const publicId = `avatars/${figureId || figureName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
        
        const signatureString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
        
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
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
        
        // Brief wait to ensure CDN availability across regions
        console.log('⏳ Waiting 2 seconds for CDN availability...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify the URL is accessible
        const verifyResponse = await fetch(finalImageUrl, { method: 'HEAD' });
        console.log('🔍 Cloudinary URL verification:', {
          status: verifyResponse.status,
          contentType: verifyResponse.headers.get('Content-Type'),
          url: finalImageUrl
        });
        
        if (!verifyResponse.ok) {
          throw new Error(`Cloudinary image not accessible: ${verifyResponse.status}`);
        }

        // Cache the generated image
        console.log('💾 Caching avatar image for future use...');
        await supabase
          .from('avatar_image_cache')
          .upsert({
            figure_id: figureId,
            figure_name: figureName,
            cloudinary_url: finalImageUrl,
            visual_prompt: visualPrompt
          }, {
            onConflict: 'figure_id'
          });
        console.log('✅ Image cached successfully');
        
      } catch (validateError) {
        console.error('❌ URL validation failed:', validateError);
        const errorMsg = validateError instanceof Error ? validateError.message : String(validateError);
        throw new Error(`Image URL validation failed: ${errorMsg}`);
      }
    }

    // Step 4: Get available voices from Akool
    console.log('🎵 Fetching available Akool voices...');
    const voicesResponse = await fetch('https://openapi.akool.com/api/open/v3/voice/list?from=3', {
      headers: {
        'x-api-key': AKOOL_API_KEY,
      }
    });

    if (!voicesResponse.ok) {
      const errorText = await voicesResponse.text();
      console.error('❌ Failed to fetch Akool voices:', errorText);
      throw new Error(`Failed to fetch Akool voices: ${errorText}`);
    }

    const voicesData = await voicesResponse.json();
    console.log('📋 Received voices:', JSON.stringify(voicesData, null, 2));

    if (voicesData.code !== 1000 || !voicesData.data || voicesData.data.length === 0) {
      throw new Error('No voices available from Akool');
    }

    // Select a voice based on gender
    const selectedVoice = voicesData.data.find((v: any) => 
      v.gender?.toLowerCase() === (gender === 'female' ? 'female' : 'male')
    ) || voicesData.data[0];

    console.log('✅ Selected voice:', selectedVoice.voice_id, '-', selectedVoice.name);

    // Step 5: Generate TTS audio using Akool's TTS API
    console.log('🎤 Generating TTS audio with Akool...');
    const ttsResponse = await fetch('https://openapi.akool.com/api/open/v3/audio/create', {
      method: 'POST',
      headers: {
        'x-api-key': AKOOL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_text: text || `Hello, I am ${figureName}`,
        voice_id: selectedVoice.voice_id,
        rate: "100%"
      })
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('❌ Akool TTS failed:', errorText);
      throw new Error(`Akool TTS failed: ${errorText}`);
    }

    const ttsData = await ttsResponse.json();
    console.log('📥 Akool TTS response:', JSON.stringify(ttsData, null, 2));

    if (ttsData.code !== 1000 || !ttsData.data?._id) {
      throw new Error(`Akool TTS failed: ${ttsData.msg || 'No task ID returned'}`);
    }

    // Poll for TTS completion
    const audioTaskId = ttsData.data._id;
    let audioFileUrl: string | null = null;
    let audioAttempts = 0;
    const maxAudioAttempts = 60;

    console.log('⏳ Waiting for TTS audio generation...');
    while (!audioFileUrl && audioAttempts < maxAudioAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Poll every 500ms
      
      const audioStatusResponse = await fetch(`https://openapi.akool.com/api/open/v3/audio/infobymodelid?audio_model_id=${audioTaskId}`, {
        headers: {
          'x-api-key': AKOOL_API_KEY,
        }
      });

      if (audioStatusResponse.ok) {
        const audioStatusData = await audioStatusResponse.json();
        
        if (audioStatusData.data?.status === 3 && audioStatusData.data?.url) {
          audioFileUrl = audioStatusData.data.url;
          console.log('✅ TTS audio ready!');
        } else if (audioStatusData.data?.status === 4) {
          console.error('❌ Akool TTS generation error:', audioStatusData);
          throw new Error('Akool TTS generation failed');
        } else {
          console.log(`⏳ TTS Status: ${audioStatusData.data?.status} (attempt ${audioAttempts + 1}/${maxAudioAttempts})`);
        }
      }

      audioAttempts++;
    }

    if (!audioFileUrl) {
      throw new Error('TTS audio generation timeout after 1 minute');
    }

    console.log('✅ TTS audio generated:', audioFileUrl);

    // Step 6: Create talking photo using the Talking Photo API
    console.log('📸 Creating talking photo...');
    console.log('📤 Photo URL:', finalImageUrl);
    console.log('🎵 Audio URL:', audioFileUrl);

    const talkingPhotoResponse = await fetch('https://openapi.akool.com/api/open/v3/content/video/createbytalkingphoto', {
      method: 'POST',
      headers: {
        'x-api-key': AKOOL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        talking_photo_url: finalImageUrl,
        audio_url: audioFileUrl
      })
    });

    const talkingPhotoData = await talkingPhotoResponse.json();
    console.log('📥 Akool Talking Photo response:', {
      status: talkingPhotoResponse.status,
      ok: talkingPhotoResponse.ok,
      code: talkingPhotoData.code,
      msg: talkingPhotoData.msg,
      photoUrl: finalImageUrl,
      audioUrl: audioFileUrl,
      fullResponse: JSON.stringify(talkingPhotoData, null, 2)
    });

    if (!talkingPhotoResponse.ok || talkingPhotoData.code !== 1000) {
      console.error('❌ Akool Talking Photo error:', {
        httpStatus: talkingPhotoResponse.status,
        responseCode: talkingPhotoData.code,
        message: talkingPhotoData.msg,
        sentPhotoUrl: finalImageUrl,
        sentAudioUrl: audioFileUrl,
        fullError: JSON.stringify(talkingPhotoData, null, 2)
      });
      throw new Error(`Akool Talking Photo failed: ${talkingPhotoData.msg || 'Unknown error'}`);
    }

    // Step 7: Poll for video completion
    const taskId = talkingPhotoData.data?._id;
    if (!taskId) {
      throw new Error('No task ID returned from Akool');
    }

    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 240; // 2 minutes with 500ms intervals

    console.log('⏳ Waiting for video generation...');
    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Poll every 500ms
      
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
      console.error('⏱️ Video generation timeout - Akool is taking too long');
      // Return a partial success so chat can continue
      return new Response(
        JSON.stringify({
          success: true,
          skipVideo: true,
          message: 'Avatar generation is taking longer than expected. Chat is ready without video.',
          taskId,
          visualPrompt
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
