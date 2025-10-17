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
    const { figureName, figureId } = await req.json();
    
    if (!figureName || !figureId) {
      throw new Error('Figure name and ID are required');
    }

    console.log('🎨 Generating portrait for:', figureName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache for existing v2 portrait
    const { data: cachedImage } = await supabase
      .from('avatar_image_cache')
      .select('cloudinary_url, visual_prompt, created_at')
      .eq('figure_id', figureId)
      .eq('cache_version', 'v2')
      .single();

    if (cachedImage) {
      const cacheAge = Date.now() - new Date(cachedImage.created_at).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (cacheAge < thirtyDays) {
        console.log('✅ Using cached portrait (v2)');
        return new Response(
          JSON.stringify({ 
            imageUrl: cachedImage.cloudinary_url,
            fromCache: true,
            prompt: cachedImage.visual_prompt
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate environmental prompt using Lovable AI
    const environmentalPrompt = await generateEnvironmentalPrompt(figureName);
    console.log('📝 Generated prompt:', environmentalPrompt.substring(0, 100) + '...');

    // Generate image using fal.ai FLUX
    const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY not configured');
    }

    console.log('🚀 Calling fal.ai FLUX model...');
    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: environmentalPrompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ fal.ai error:', response.status, errorText);
      throw new Error(`fal.ai error: ${response.status}`);
    }

    const result = await response.json();
    const imageUrl = result.images[0].url;
    console.log('✅ Image generated:', imageUrl);

    // Cache the result
    await supabase
      .from('avatar_image_cache')
      .upsert({
        figure_id: figureId,
        figure_name: figureName,
        cloudinary_url: imageUrl,
        visual_prompt: environmentalPrompt,
        cache_version: 'v2',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'figure_id,cache_version'
      });

    return new Response(
      JSON.stringify({ 
        imageUrl,
        fromCache: false,
        prompt: environmentalPrompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in fal-generate-portrait:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateEnvironmentalPrompt(figureName: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return getFallbackPrompt(figureName);
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Create a detailed environmental portrait prompt for ${figureName}. The scene should capture their most iconic historical moment or setting with photorealistic detail. Include:
- Specific historical location and time period
- Environmental details (weather, lighting, surroundings)
- Their characteristic clothing/appearance
- Emotional expression fitting the moment
- Camera angle and composition

Keep it under 200 words. Start directly with the description, no preamble.`
        }],
      }),
    });

    if (!response.ok) {
      return getFallbackPrompt(figureName);
    }

    const data = await response.json();
    const prompt = data.choices[0].message.content;
    
    return `${prompt}. Ultra high resolution environmental portrait, photorealistic, cinematic lighting, detailed facial features, 8K, masterpiece quality, professional photography`;
  } catch (error) {
    console.error('Error generating AI prompt:', error);
    return getFallbackPrompt(figureName);
  }
}

function getFallbackPrompt(figureName: string): string {
  return `Photorealistic environmental portrait of ${figureName} in their most iconic historical setting, dramatic natural lighting, detailed facial features, period-accurate clothing, expressive eyes, cinematic composition, ultra high resolution, 8K, masterpiece quality`;
}
