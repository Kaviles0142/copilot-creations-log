import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, text, figureName, figureId, frameCount = 5 } = await req.json();

    if (!imageUrl || !text) {
      throw new Error('imageUrl and text are required');
    }

    console.log('🎬 K2 + Nano Banana Avatar Animation');
    console.log('📸 Base image:', imageUrl.substring(0, 60) + '...');
    console.log('📝 Text length:', text.length, 'chars');
    console.log('🎞️ Requested frames:', frameCount);

    const MOONSHOT_API_KEY = Deno.env.get('MOONSHOT_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!MOONSHOT_API_KEY) {
      throw new Error('MOONSHOT_API_KEY not configured');
    }
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Step 1: Use K2 to analyze the text and generate frame descriptions
    console.log('🧠 Step 1: Using K2 to analyze speech and generate frame descriptions...');
    
    const k2Response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [
          {
            role: 'system',
            content: `You are an animation director specializing in facial expressions and lip-sync. 
Your task is to break down speech into ${frameCount} key frames for portrait animation.

For each frame, describe:
1. Mouth position (closed, slightly open, wide open, rounded for 'O', etc.)
2. Expression (neutral, slight smile, speaking intensity, eyebrow position)
3. Which part of the speech this frame represents

Return ONLY a JSON array with exactly ${frameCount} objects, each with:
- "frameNumber": 1 to ${frameCount}
- "mouthPosition": description of mouth shape
- "expression": overall facial expression
- "speechSegment": the words being spoken in this frame
- "prompt": a detailed prompt for generating this specific frame

Example format:
[
  {"frameNumber": 1, "mouthPosition": "slightly open", "expression": "beginning to speak, slight anticipation", "speechSegment": "Hello", "prompt": "Portrait speaking, mouth slightly open as if saying 'He', neutral attentive expression"},
  ...
]`
          },
          {
            role: 'user',
            content: `The historical figure ${figureName || 'in the portrait'} is saying: "${text.substring(0, 500)}${text.length > 500 ? '...' : ''}"

Generate exactly ${frameCount} animation frames that capture the key moments of this speech. Focus on natural mouth movements and expressions that match the content.`
          }
        ],
        temperature: 0.7,
      })
    });

    if (!k2Response.ok) {
      const errorText = await k2Response.text();
      console.error('❌ K2 error:', k2Response.status, errorText);
      throw new Error(`K2 failed: ${k2Response.status}`);
    }

    const k2Data = await k2Response.json();
    const k2Content = k2Data.choices?.[0]?.message?.content || '';
    console.log('✅ K2 response received, length:', k2Content.length);

    // Parse the JSON array from K2's response
    let frameDescriptions: any[];
    try {
      // Extract JSON from the response (K2 might wrap it in markdown)
      const jsonMatch = k2Content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in K2 response');
      }
      frameDescriptions = JSON.parse(jsonMatch[0]);
      console.log('📋 Parsed', frameDescriptions.length, 'frame descriptions');
    } catch (parseError) {
      console.error('❌ Failed to parse K2 response:', parseError);
      console.log('Raw response:', k2Content.substring(0, 500));
      throw new Error('Failed to parse frame descriptions from K2');
    }

    // Step 2: Use nano banana to generate each frame
    console.log('🍌 Step 2: Generating portrait frames with nano banana...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const frames: { frameNumber: number; imageUrl: string; speechSegment: string }[] = [];
    
    // Process frames in parallel (batches of 2 to avoid rate limits)
    const batchSize = 2;
    for (let i = 0; i < frameDescriptions.length; i += batchSize) {
      const batch = frameDescriptions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (frame: any) => {
        const framePrompt = `Edit this portrait of ${figureName || 'a historical figure'} to show them speaking. 
${frame.prompt}
Mouth position: ${frame.mouthPosition}
Expression: ${frame.expression}
Keep the same person, same clothing, same background. Only change the mouth and subtle facial expression.
Photorealistic, high quality, consistent with the original portrait.`;

        console.log(`🎨 Generating frame ${frame.frameNumber}:`, frame.mouthPosition);

        try {
          const nanoResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  content: [
                    {
                      type: 'text',
                      text: framePrompt
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: imageUrl
                      }
                    }
                  ]
                }
              ],
              modalities: ['image', 'text']
            })
          });

          if (!nanoResponse.ok) {
            const errorText = await nanoResponse.text();
            console.error(`❌ Nano banana error for frame ${frame.frameNumber}:`, nanoResponse.status, errorText);
            return null;
          }

          const nanoData = await nanoResponse.json();
          const generatedImage = nanoData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (!generatedImage) {
            console.error(`❌ No image generated for frame ${frame.frameNumber}`);
            return null;
          }

          // Upload to storage
          const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const fileName = `animated-frames/${figureId || 'unknown'}-frame-${frame.frameNumber}-${Date.now()}.png`;

          const { error: uploadError } = await supabase.storage
            .from('audio-files')
            .upload(fileName, imageBuffer, {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            console.error(`❌ Upload error for frame ${frame.frameNumber}:`, uploadError);
            return null;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('audio-files')
            .getPublicUrl(fileName);

          console.log(`✅ Frame ${frame.frameNumber} generated:`, publicUrl.substring(0, 60) + '...');

          return {
            frameNumber: frame.frameNumber,
            imageUrl: publicUrl,
            speechSegment: frame.speechSegment
          };
        } catch (frameError) {
          console.error(`❌ Error generating frame ${frame.frameNumber}:`, frameError);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      frames.push(...batchResults.filter(f => f !== null));
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < frameDescriptions.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎬 Animation complete! Generated ${frames.length}/${frameCount} frames`);

    return new Response(
      JSON.stringify({
        success: true,
        frames: frames.sort((a, b) => a.frameNumber - b.frameNumber),
        totalFrames: frames.length,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in k2-animate-portrait:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
