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
    const { figureName, figureId, context } = await req.json();

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

    // Generate new portrait using OpenAI DALL-E
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const prompt = generateVisualPrompt(figureName, context);
    console.log('📝 Visual prompt:', prompt);

    const aiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'png'
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ OpenAI DALL-E error:', errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const base64Image = aiData.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new Error('No image generated from DALL-E');
    }

    console.log('✅ Portrait generated successfully via DALL-E');

    // Upload image to Supabase Storage
    const imageBuffer = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    const fileName = `${figureId}-${Date.now()}.png`;
    
    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/audio-files/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/png',
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      console.error('❌ Storage upload error:', uploadError);
      throw new Error(`Failed to upload image to storage: ${uploadError}`);
    }

    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/audio-files/${fileName}`;
    console.log('✅ Image uploaded to Supabase Storage:', imageUrl);

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

function generateVisualPrompt(figureName: string, context?: string): string {
  const contextText = context 
    ? `${context}. The setting should complement their historical background while maintaining the ${context} environment.`
    : 'Professional studio lighting with a subtle gradient background appropriate to their era.';
    
  return `Create a professional, photorealistic portrait photograph of ${figureName} in a ${context || 'studio setting'}. CRITICAL REQUIREMENTS: The face must be perfectly centered and fill 60% of the frame. Eyes must be positioned at exactly 40% from the top of the image. The subject should face directly forward with a neutral, welcoming expression. ${contextText} Head and shoulders only, straight-on angle. Historically accurate facial features and period-appropriate attire visible from shoulders up. Ultra high resolution, 4K quality.`;
}
