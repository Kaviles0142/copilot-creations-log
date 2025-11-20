import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
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

    // Initialize Supabase client with service role (bypasses RLS)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check cache using database function (most reliable method)
    console.log('🔍 Checking cache for figure_id:', figureId);
    
    const { data: cachedResults, error: cacheError } = await supabase
      .rpc('get_cached_avatar', { p_figure_id: figureId });

    console.log('📊 Cache RPC result:', { 
      found: cachedResults && cachedResults.length > 0, 
      error: cacheError,
      data: cachedResults 
    });

    if (!cacheError && cachedResults && cachedResults.length > 0) {
      const cachedImage = cachedResults[0];
      console.log('✅ Using cached portrait from:', cachedImage.created_at);
      console.log('📸 Cache URL:', cachedImage.cloudinary_url);
      return new Response(JSON.stringify({
        imageUrl: cachedImage.cloudinary_url,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎨 No valid cache found, generating new portrait...');

    // Generate new portrait using OpenAI DALL-E 3
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
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        response_format: 'url'
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ OpenAI DALL-E error:', errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E 3');
    }

    console.log('✅ Portrait generated successfully via DALL-E 3');

    // Download the image from OpenAI's URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image');
    }

    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
    console.log('✅ Image downloaded successfully');

    // Upload image to Supabase Storage using client
    const fileName = `${figureId}-${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('audio-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('audio-files')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to Supabase Storage:', publicUrl);

    // Cache the image using client
    console.log('💾 Attempting to cache:', { figure_id: figureId, figure_name: figureName, url: publicUrl });
    
    const { data: insertedData, error: cacheInsertError } = await supabase
      .from('avatar_image_cache')
      .insert({
        figure_id: figureId,
        figure_name: figureName,
        cloudinary_url: publicUrl,
        visual_prompt: prompt,
      })
      .select();

    if (cacheInsertError) {
      console.error('❌ Cache insert FAILED:', cacheInsertError);
      console.error('Error details:', JSON.stringify(cacheInsertError, null, 2));
    } else if (insertedData && insertedData.length > 0) {
      console.log('✅ Portrait cached successfully with ID:', insertedData[0].id);
    } else {
      console.error('⚠️ Cache insert returned no data but no error');
    }

    return new Response(JSON.stringify({
      imageUrl: publicUrl,
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
