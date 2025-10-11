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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Helper function to generate visual prompt
    const generateVisualPrompt = async (useGenericStyle = false): Promise<string> => {
      console.log(useGenericStyle ? '🎨 Generating GENERIC visual prompt...' : '🎨 Generating visual prompt...');
      
      const styleInstruction = useGenericStyle 
        ? `Create a detailed visual description for a STYLIZED, ARTISTIC portrait of ${figureName}. Use:
- Painterly or illustrated style (NOT photorealistic)
- Soft focus and artistic interpretation
- Historical costume/attire style
- Emphasis on period-appropriate clothing and setting rather than facial accuracy
- Think classical painting or illustration style, not photography

The goal is a respectful, artistic representation that avoids exact likeness.`
        : `Create a detailed visual description for generating a portrait of ${figureName}. Include:
1. Physical appearance (face, hair, age, distinctive features)
2. Era-appropriate clothing and accessories
3. Background setting (should be relevant to their time/location)
4. Facial expression and posture
5. Photorealistic portrait style`;

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

    // Step 1: Generate initial visual prompt
    let visualPrompt = await generateVisualPrompt(false);

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
    let imageUrl = publicUrl;
    
    console.log('✅ Image ready for D-ID');

    // Step 4: Create D-ID talking avatar with audio or text
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
    let usedGenericAvatar = false;

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
        
        // Check if this is a celebrity detection error (451)
        if (didResponse.status === 451 && errorText.includes('CelebrityDetectedError') && !usedGenericAvatar) {
          console.log('🎭 Celebrity detected, regenerating with generic artistic style...');
          
          // Regenerate with generic style
          visualPrompt = await generateVisualPrompt(true);
          
          // Generate new image with generic style
          const genericImageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  content: `Generate a stylized, artistic portrait (NOT photorealistic): ${visualPrompt}`
                }
              ],
              modalities: ['image', 'text']
            }),
          });

          if (!genericImageResponse.ok) {
            throw new Error('Failed to generate generic portrait');
          }

          const genericImageData = await genericImageResponse.json();
          const genericBase64Image = genericImageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (!genericBase64Image) {
            throw new Error('No generic image generated');
          }

          console.log('✅ Generic portrait generated');

          // Upload new generic image
          const genericBase64Data = genericBase64Image.split(',')[1];
          const genericBinaryString = atob(genericBase64Data);
          const genericBytes = new Uint8Array(genericBinaryString.length);
          for (let i = 0; i < genericBinaryString.length; i++) {
            genericBytes[i] = genericBinaryString.charCodeAt(i);
          }

          const genericFileName = `${figureId}-generic-${Date.now()}.png`;
          const { error: genericUploadError } = await supabase.storage
            .from('audio-files')
            .upload(genericFileName, genericBytes, {
              contentType: 'image/png',
              upsert: true
            });

          if (genericUploadError) {
            throw new Error('Failed to upload generic image');
          }

          const { data: { publicUrl: genericPublicUrl } } = supabase.storage
            .from('audio-files')
            .getPublicUrl(genericFileName);

          console.log('✅ Generic avatar image uploaded:', genericPublicUrl);
          
          // Update payload with new generic image
          didPayload.source_url = genericPublicUrl;
          imageUrl = genericPublicUrl;
          usedGenericAvatar = true;
          retryCount = 0; // Reset retry count for new image
          continue;
        }
        
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          // If all attempts failed due to celebrity detection, return success without video
          if (didResponse.status === 451 && errorText.includes('CelebrityDetectedError')) {
            console.log('🎭 All D-ID attempts failed due to celebrity detection, continuing without avatar video');
            return new Response(
              JSON.stringify({ 
                success: true,
                usedGenericAvatar: true,
                skipVideo: true,
                visualPrompt: visualPrompt,
                message: 'Avatar generation skipped due to celebrity detection. Chat is still available.'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
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

    // Step 5: Poll for video completion
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
        talkId,
        usedGenericAvatar
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
