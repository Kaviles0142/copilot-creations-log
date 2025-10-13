import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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

    console.log('🎨 Generating portrait for:', figureName);

    // Check if we have a cached image
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check cache first
    const cacheResponse = await fetch(`${SUPABASE_URL}/rest/v1/avatar_image_cache?figure_id=eq.${figureId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (cacheResponse.ok) {
      const cached = await cacheResponse.json();
      if (cached && cached.length > 0 && cached[0].cloudinary_url) {
        console.log('✅ Using cached portrait:', cached[0].cloudinary_url);
        return new Response(JSON.stringify({
          imageUrl: cached[0].cloudinary_url,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate new portrait using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = generateVisualPrompt(figureName);
    console.log('📝 Visual prompt:', prompt);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{
          role: 'user',
          content: prompt
        }],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Lovable AI error:', errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    console.log('✅ Portrait generated successfully');

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
        }),
      });
      console.log('💾 Portrait cached successfully');
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
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateVisualPrompt(figureName: string): string {
  return `Create a professional passport-style portrait photograph of ${figureName}. CRITICAL REQUIREMENTS: The face must be perfectly centered and fill 60% of the frame. Eyes must be positioned at exactly 40% from the top of the image. The subject should face directly forward with a neutral, welcoming expression. Professional studio lighting with a subtle gradient background appropriate to their era. Head and shoulders only, straight-on angle. Ultra high resolution, photorealistic, historically accurate facial features and period-appropriate attire visible from shoulders up.`;
}
