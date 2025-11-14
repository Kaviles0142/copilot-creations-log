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

    // Check cache for existing v3 portrait (workspace/iconic setting focus)
    const { data: cachedImage, error: cacheError } = await supabase
      .from('avatar_image_cache')
      .select('cloudinary_url, visual_prompt, created_at')
      .eq('figure_id', figureId)
      .eq('cache_version', 'v3')
      .maybeSingle();

    if (cachedImage) {
      const cacheAge = Date.now() - new Date(cachedImage.created_at).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (cacheAge < thirtyDays) {
        console.log('✅ Using cached portrait (v3)');
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

    // Generate image using Lovable AI (faster, no external API needed)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🚀 Generating portrait with Lovable AI...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{
          role: 'user',
          content: environmentalPrompt
        }],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const result = await response.json();
    const base64Image = result.choices?.[0]?.message?.images?.[0]?.image_url?.url?.split(',')[1];
    
    if (!base64Image) {
      throw new Error('No image generated from Lovable AI');
    }
    
    console.log('✅ Portrait generated via Lovable AI');

    // Upload to Supabase Storage and cache
    const imageBuffer = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    const fileName = `portraits/${figureId}-${Date.now()}.png`;
    
    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/audio-files/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'image/png',
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      console.error('❌ Storage upload error:', uploadError);
      throw new Error(`Failed to upload to Supabase Storage: ${uploadError}`);
    }

    const uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/audio-files/${fileName}`;
    console.log('✅ Image uploaded to Supabase Storage:', uploadedImageUrl);

    // Cache the result as v3
    await supabase
      .from('avatar_image_cache')
      .upsert({
        figure_id: figureId,
        figure_name: figureName,
        cloudinary_url: uploadedImageUrl,
        visual_prompt: environmentalPrompt,
        cache_version: 'v3',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'figure_id,cache_version'
      });

    console.log('💾 Portrait cached successfully');

    return new Response(
      JSON.stringify({ 
        imageUrl: uploadedImageUrl,
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
          content: `Create a detailed environmental portrait prompt for ${figureName} in their MOST ICONIC WORKPLACE or historical moment. This should capture where they made their greatest contributions.

For scientists: Laboratory, observatory, or study with period-accurate equipment
For writers/artists: Writing desk, studio, or creative workspace with tools
For leaders/politicians: Office, chamber, or significant historical setting
For inventors: Workshop with inventions and tools
For philosophers: Study with books and writing materials

Include:
- Specific workplace details (equipment, books, tools, documents)
- Period-accurate setting and clothing
- Natural or lamp lighting creating dramatic mood
- Focused, engaged expression (working, thinking, creating)
- Medium shot showing both subject and environment
- Historic authenticity

CRITICAL: Show them ACTIVELY ENGAGED in their work - not posed, not at home casually, not just standing. Capture the moment of their greatness.
Keep under 200 words. Start with the description.`
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
  return `Photorealistic environmental portrait of ${figureName} in their iconic workplace - laboratory, office, or study with period-accurate scientific equipment and books visible, seated at desk or workbench, focused expression, natural window lighting, detailed facial features, period-accurate clothing, cinematic composition, ultra high resolution, 8K, masterpiece quality, professional photography`;
}
