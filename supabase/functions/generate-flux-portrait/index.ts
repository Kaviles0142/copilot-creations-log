import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

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

    if (!figureName) {
      throw new Error('figureName is required');
    }

    console.log('🎨 Generating FLUX environmental portrait for:', figureName);

    // Check if we have a cached image
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check cache first (v2 = environmental scenes, v1 = old portraits)
    const CACHE_VERSION = 'v2';
    const cacheResponse = await fetch(`${SUPABASE_URL}/rest/v1/avatar_image_cache?figure_id=eq.${figureId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (cacheResponse.ok) {
      const cached = await cacheResponse.json();
      // Only use cache if it has v2 (environmental) version
      if (cached && cached.length > 0 && cached[0].cloudinary_url && cached[0].cache_version === CACHE_VERSION) {
        console.log('✅ Using cached FLUX portrait:', cached[0].cloudinary_url);
        return new Response(JSON.stringify({
          imageUrl: cached[0].cloudinary_url,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (cached && cached.length > 0) {
        console.log('🔄 Old cache version found, regenerating...');
      }
    }

    // Generate new environmental scene using Replicate FLUX
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY not configured');
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const prompt = await generateEnvironmentalPrompt(figureName);
    console.log('📝 Environmental prompt:', prompt);

    console.log('🚀 Starting FLUX generation...');
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90,
          num_inference_steps: 4
        }
      }
    ) as string[];

    if (!output || output.length === 0) {
      throw new Error('No image generated from FLUX');
    }

    const imageUrl = output[0];
    console.log('✅ FLUX environmental portrait generated:', imageUrl);

    // Cache the image
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/avatar_image_cache`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          figure_id: figureId,
          figure_name: figureName,
          cloudinary_url: imageUrl,
          visual_prompt: prompt,
          cache_version: 'v2', // Mark as environmental scene version
        }),
      });
      console.log('💾 FLUX portrait cached successfully');
    } catch (cacheError) {
      console.error('Cache save failed:', cacheError);
      // Continue anyway - cache failure isn't critical
    }

    return new Response(JSON.stringify({
      imageUrl,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in FLUX generation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateEnvironmentalPrompt(figureName: string): Promise<string> {
  // Use Lovable AI to generate a detailed environmental prompt for ANY figure
  console.log(`🤖 Generating AI prompt for ${figureName}...`);
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('⚠️ LOVABLE_API_KEY not found, using generic fallback');
    const environmentDetail = `in their characteristic historical setting, period-accurate clothing and environment, warm professional lighting, determined expression`;
    return `Photorealistic scene of ${figureName} ${environmentDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  }

  try {
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Generate a detailed, vivid environmental scene description for a photorealistic portrait of ${figureName}. Include:
1. Their most iconic location/setting (e.g., office, lab, studio, battlefield)
2. Specific time period and era details
3. Period-accurate clothing description
4. Characteristic objects, tools, or props associated with them
5. Lighting style appropriate to the era
6. Their typical expression or demeanor

Format: Write a single flowing description starting with "in [location], [time period]..." Do NOT include the person's name. Just describe the environment, clothing, and scene. Maximum 60 words.

Example format: "in his Princeton office, 1940s, sitting at a wooden desk covered with physics papers and equations, chalkboards with formulas visible in the background, warm afternoon sunlight streaming through tall windows, period-accurate dark suit, messy gray hair, thoughtful expression"`
        }]
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiGeneratedDetail = aiData.choices?.[0]?.message?.content?.trim();
    
    if (!aiGeneratedDetail) {
      throw new Error('No content in AI response');
    }

    console.log(`✅ AI-generated detail: ${aiGeneratedDetail}`);
    
    return `Photorealistic scene of ${figureName} ${aiGeneratedDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  } catch (error) {
    console.error('❌ AI prompt generation failed:', error);
    // Fallback to generic prompt
    const environmentDetail = `in their characteristic historical setting, period-accurate clothing and environment, warm professional lighting, determined expression`;
    return `Photorealistic scene of ${figureName} ${environmentDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  }
}
