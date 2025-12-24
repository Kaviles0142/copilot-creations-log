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
    const { imageUrl, text, figureName, figureId, frameCount = 3 } = await req.json();

    if (!imageUrl || !text) {
      throw new Error('imageUrl and text are required');
    }

    console.log('🎬 K2 + Nano Banana Avatar Animation (OPTIMIZED)');
    console.log('📸 Base image:', imageUrl.substring(0, 60) + '...');
    console.log('📝 Text length:', text.length, 'chars');
    console.log('🎞️ Frames:', frameCount);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simplified frame descriptions - skip K2 call, use direct prompts
    const mouthPositions = [
      { position: 'slightly open, beginning to speak', expression: 'attentive, about to speak' },
      { position: 'open wide, mid-speech', expression: 'engaged, speaking actively' },
      { position: 'rounded as if saying O sound', expression: 'emphatic, making a point' },
    ];

    // Take only needed frames
    const frameDescriptions = mouthPositions.slice(0, frameCount);
    console.log('📋 Using', frameDescriptions.length, 'optimized frame descriptions');

    const frames: { frameNumber: number; imageUrl: string; speechSegment: string }[] = [];
    
    // Process ALL frames in parallel (no batching delay)
    const framePromises = frameDescriptions.map(async (frame, index) => {
      const frameNumber = index + 1;
      const framePrompt = `Edit this portrait of ${figureName || 'a historical figure'} to show them speaking.
Mouth: ${frame.position}
Expression: ${frame.expression}
Keep the same person, same clothing, same background. Only change the mouth and subtle facial expression.
Photorealistic, high quality, consistent lighting.`;

      console.log(`🎨 Generating frame ${frameNumber}...`);

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
                  { type: 'text', text: framePrompt },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ],
            modalities: ['image', 'text']
          })
        });

        if (!nanoResponse.ok) {
          const errorText = await nanoResponse.text();
          console.error(`❌ Frame ${frameNumber} error:`, nanoResponse.status, errorText);
          return null;
        }

        const nanoData = await nanoResponse.json();
        const generatedImage = nanoData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!generatedImage) {
          console.error(`❌ No image for frame ${frameNumber}`);
          return null;
        }

        // Upload to storage
        const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `animated-frames/${figureId || 'unknown'}-frame-${frameNumber}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error(`❌ Upload error frame ${frameNumber}:`, uploadError);
          return null;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('audio-files')
          .getPublicUrl(fileName);

        console.log(`✅ Frame ${frameNumber} ready`);

        return {
          frameNumber,
          imageUrl: publicUrl,
          speechSegment: `Part ${frameNumber}`
        };
      } catch (frameError) {
        console.error(`❌ Error frame ${frameNumber}:`, frameError);
        return null;
      }
    });

    const results = await Promise.all(framePromises);
    frames.push(...results.filter(f => f !== null));

    console.log(`🎬 Generated ${frames.length}/${frameCount} frames`);

    return new Response(
      JSON.stringify({
        success: frames.length > 0,
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
