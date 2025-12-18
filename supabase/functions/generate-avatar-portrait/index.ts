import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Adaptive provider priority system (in-memory)
let providerPriority: ('lovable' | 'openai')[] = ['lovable', 'openai'];
let lastProviderCheck = Date.now();
const PRIORITY_RESET_INTERVAL = 3600000; // Reset priority every hour (1 hour = 3600000ms)

function getProviders(): ('lovable' | 'openai')[] {
  // Reset priority periodically to give failed providers another chance
  if (Date.now() - lastProviderCheck > PRIORITY_RESET_INTERVAL) {
    console.log('⏰ Resetting provider priority to default (hourly retry)');
    providerPriority = ['lovable', 'openai'];
    lastProviderCheck = Date.now();
  }
  return [...providerPriority]; // Return copy to prevent external modification
}

function markProviderFailed(failedProvider: 'lovable' | 'openai') {
  // Move failed provider to end of list
  providerPriority = providerPriority.filter(p => p !== failedProvider);
  providerPriority.push(failedProvider);
  console.log(`⚠️ ${failedProvider} marked as failed, new priority order:`, providerPriority);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId, context } = await req.json();

    if (!figureName) {
      throw new Error('figureName is required');
    }

    console.log('🎨 Getting portrait for:', figureName);

    // Initialize Supabase client with service role (bypasses RLS)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check cache first
    console.log('🔍 Checking cache for figure_id:', figureId);
    
    const { data: cachedResults, error: cacheError } = await supabase
      .from('avatar_image_cache')
      .select('*')
      .eq('figure_id', figureId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cacheError && cachedResults && cachedResults.length > 0) {
      const cachedImage = cachedResults[0];
      console.log('✅ Using cached portrait from:', cachedImage.created_at);
      return new Response(JSON.stringify({
        imageUrl: cachedImage.cloudinary_url,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 No cache found, generating podcast studio portrait...');

    // ALWAYS generate AI portrait with podcast studio context
    // Real Wikipedia photos don't show the figure in a studio setting
    console.log('🎨 Generating AI studio portrait for:', figureName);

    // Get API keys
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    const prompt = generateVisualPrompt(figureName, context);
    console.log('📝 Visual prompt:', prompt);

    let base64Image: string | undefined;
    let usedProvider = 'unknown';

    // Get current provider priority order
    const providers = getProviders();
    console.log('🔄 Current provider priority:', providers);

    // Try providers in priority order
    for (const provider of providers) {
      if (provider === 'lovable' && LOVABLE_API_KEY) {
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
            console.error('❌ Lovable AI failed:', lovableResponse.status, errorText);
            throw new Error(`Lovable AI failed: ${errorText}`);
          }

          const lovableData = await lovableResponse.json();
          base64Image = lovableData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (base64Image) {
            usedProvider = 'Lovable AI';
            console.log('✅ Successfully generated with Lovable AI');
            break; // Success - stop trying other providers
          } else {
            throw new Error('No image data in Lovable AI response');
          }
        } catch (lovableError) {
          console.error('⚠️ Lovable AI error:', lovableError);
          markProviderFailed('lovable');
          // Continue to next provider
        }
      } else if (provider === 'openai' && OPENAI_API_KEY) {
        try {
          console.log('🎨 Attempting generation with OpenAI DALL-E...');
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
            console.error('❌ OpenAI DALL-E failed:', openaiResponse.status, errorText);
            throw new Error(`OpenAI DALL-E failed: ${errorText}`);
          }

          const openaiData = await openaiResponse.json();
          
          // OpenAI returns base64 directly in b64_json field when output_format is png
          if (openaiData.data?.[0]?.b64_json) {
            base64Image = `data:image/png;base64,${openaiData.data[0].b64_json}`;
            usedProvider = 'OpenAI DALL-E';
            console.log('✅ Successfully generated with OpenAI DALL-E');
            break; // Success - stop trying other providers
          } else {
            throw new Error('No image data in OpenAI response');
          }
        } catch (openaiError) {
          console.error('⚠️ OpenAI error:', openaiError);
          markProviderFailed('openai');
          // Continue to next provider
        }
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
  // Always generate podcast studio portraits
  return `Create a professional, photorealistic portrait photograph of ${figureName} sitting in a modern podcast recording studio. CRITICAL REQUIREMENTS: The subject is seated at a podcast desk with professional microphones visible. The background shows acoustic panels, studio monitors, and warm ambient lighting typical of a high-end podcast studio. The face must be perfectly centered and fill 60% of the frame. Eyes must be positioned at exactly 40% from the top of the image. The subject should face directly forward with a neutral, welcoming expression ready for conversation. Historically accurate facial features and period-appropriate attire visible from shoulders up. The lighting should be professional studio lighting with soft shadows. Ultra high resolution, 4K quality, photorealistic.`;
}
