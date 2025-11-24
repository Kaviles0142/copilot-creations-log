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

    // Check cache - query directly to inspect visual_prompt for context matching
    console.log('🔍 Checking cache for figure_id:', figureId);
    
    const { data: cachedResults, error: cacheError } = await supabase
      .from('avatar_image_cache')
      .select('*')
      .eq('figure_id', figureId)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('📊 Cache query result:', { 
      found: cachedResults && cachedResults.length > 0, 
      error: cacheError,
      data: cachedResults 
    });

    // Check if cached avatar matches the requested context
    if (!cacheError && cachedResults && cachedResults.length > 0) {
      const cachedImage = cachedResults[0];
      const cachedPrompt = cachedImage.visual_prompt || '';
      
      // If context is provided, verify the cached prompt contains it
      if (context) {
        if (cachedPrompt.toLowerCase().includes(context.toLowerCase())) {
          console.log('✅ Using cached portrait with matching context from:', cachedImage.created_at);
          console.log('📸 Cache URL:', cachedImage.cloudinary_url);
          return new Response(JSON.stringify({
            imageUrl: cachedImage.cloudinary_url,
            cached: true,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.log('⚠️ Cached portrait found but context mismatch. Expected context:', context);
          console.log('⚠️ Cached prompt:', cachedPrompt);
        }
      } else {
        // No specific context required, use cache
        console.log('✅ Using cached portrait from:', cachedImage.created_at);
        console.log('📸 Cache URL:', cachedImage.cloudinary_url);
        return new Response(JSON.stringify({
          imageUrl: cachedImage.cloudinary_url,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('🎨 No valid cache found, generating new portrait...');

    // Generate new portrait - try Lovable AI first, fallback to OpenAI DALL-E
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    const prompt = generateVisualPrompt(figureName, context);
    console.log('📝 Visual prompt:', prompt);

    let base64Image: string | undefined;
    let usedProvider = 'unknown';

    // Try Lovable AI first
    if (LOVABLE_API_KEY) {
      try {
        console.log('🎨 Attempting generation with Lovable AI...');
        const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: `Generate a photorealistic portrait: ${prompt}`
              }
            ],
            modalities: ['image', 'text']
          })
        });

        if (!lovableResponse.ok) {
          const errorText = await lovableResponse.text();
          console.error('❌ Lovable AI failed:', errorText);
          throw new Error(`Lovable AI failed: ${errorText}`);
        }

        const lovableData = await lovableResponse.json();
        base64Image = lovableData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (base64Image) {
          usedProvider = 'Lovable AI';
          console.log('✅ Successfully generated with Lovable AI');
        }
      } catch (lovableError) {
        console.log('⚠️ Lovable AI failed, will try fallback...');
      }
    }

    // Fallback to OpenAI DALL-E if Lovable AI failed or unavailable
    if (!base64Image && OPENAI_API_KEY) {
      try {
        console.log('🎨 Attempting generation with OpenAI DALL-E (fallback)...');
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
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

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('❌ OpenAI DALL-E failed:', errorText);
          throw new Error(`OpenAI DALL-E failed: ${errorText}`);
        }

        const openaiData = await openaiResponse.json();
        
        // OpenAI returns base64 directly in b64_json field when output_format is png
        if (openaiData.data?.[0]?.b64_json) {
          base64Image = `data:image/png;base64,${openaiData.data[0].b64_json}`;
          usedProvider = 'OpenAI DALL-E';
          console.log('✅ Successfully generated with OpenAI DALL-E');
        }
      } catch (openaiError) {
        console.error('❌ OpenAI DALL-E also failed:', openaiError);
      }
    }

    if (!base64Image) {
      throw new Error('All image generation providers failed. Please check API keys and credits.');
    }

    console.log(`✅ Portrait generated successfully via ${usedProvider}`);

    // Extract base64 data (remove data:image/png;base64, prefix if present)
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    console.log('✅ Image decoded from base64');

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
