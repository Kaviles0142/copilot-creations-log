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
    const { figureName, text, figureId } = await req.json();
    console.log('🎬 Creating D-ID avatar for:', figureName);

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

    // Step 2: Use a static placeholder image that D-ID will accept
    // D-ID requires URLs ending in .jpg, .jpeg, or .png (no query params)
    console.log('🖼️ Using static placeholder image...');
    
    // Use a generic historical figure portrait from a reliable CDN
    const imageUrl = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face';
    
    console.log('✅ Image URL ready');

    // Step 3: Create D-ID talking avatar with text
    console.log('🎭 Creating D-ID talking avatar...');
    
    const didPayload = {
      source_url: imageUrl,
      script: {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: 'en-GB-RyanNeural'
        }
      },
      config: {
        stitch: true,
        result_format: 'mp4'
      },
      driver_url: 'bank://lively/'
    };

    const didResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(didPayload)
    });

    if (!didResponse.ok) {
      const errorText = await didResponse.text();
      console.error('❌ D-ID API error:', errorText);
      throw new Error(`D-ID API failed: ${didResponse.status} - ${errorText}`);
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
