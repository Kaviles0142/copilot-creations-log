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
    const { figures, topic, scene } = await req.json();

    if (!figures || !Array.isArray(figures) || figures.length === 0) {
      throw new Error('figures array is required');
    }

    console.log('🎙️ Generating podcast scene for:', figures, 'Topic:', topic, 'Scene:', scene);

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create a cache key including topic and scene for unique images
    const sortedFigures = [...figures].sort();
    const topicSlug = (topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const sceneId = scene || 'studio';
    const cacheKey = `podcast-${sceneId}-${topicSlug}-${sortedFigures.map(f => f.toLowerCase().replace(/\s+/g, '-')).join('-')}`;
    
    // Check cache first
    console.log('🔍 Checking cache for:', cacheKey);
    const { data: cachedResults, error: cacheError } = await supabase
      .from('avatar_image_cache')
      .select('*')
      .eq('figure_id', cacheKey)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cacheError && cachedResults && cachedResults.length > 0) {
      console.log('✅ Using cached podcast scene from:', cachedResults[0].created_at);
      return new Response(JSON.stringify({
        imageUrl: cachedResults[0].cloudinary_url,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎨 No cache found, generating new podcast scene...');

    // Build creative prompt with topic incorporated
    const prompt = buildPodcastPrompt(figures, topic, sceneId);
    console.log('📝 Prompt:', prompt);

    // Get API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🎨 Generating with Lovable AI...');
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
          content: prompt
        }],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI failed:', response.status, errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const data = await response.json();
    const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) {
      throw new Error('No image data in response');
    }

    console.log('✅ Image generated successfully');

    // Extract base64 and upload to storage
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${cacheKey.slice(0, 100)}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded:', publicUrl);

    // Cache the result
    const { error: cacheInsertError } = await supabase
      .from('avatar_image_cache')
      .upsert({
        figure_id: cacheKey,
        figure_name: `Podcast: ${figures.join(', ')}`,
        cloudinary_url: publicUrl,
        visual_prompt: prompt.substring(0, 500),
      }, { onConflict: 'figure_id' });

    if (cacheInsertError) {
      console.error('⚠️ Cache insert warning:', cacheInsertError);
    }

    return new Response(JSON.stringify({
      imageUrl: publicUrl,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPodcastPrompt(figures: string[], topic?: string, scene?: string): string {
  const names = figures.join(' and ');
  const topicContext = topic ? `discussing "${topic}"` : 'in deep conversation';
  
  // Scene-specific settings with creative topic integration
  const scenePrompts: Record<string, string> = {
    studio: `Photorealistic cinematic photo of ${names} in an intimate podcast studio, ${topicContext}. Professional microphones, warm amber lighting, acoustic foam walls with subtle neon accents. Cozy leather armchairs arranged in a circle. ${topic ? `Visual hints of the topic "${topic}" subtly incorporated - perhaps relevant books on a side table or themed decorations.` : ''} Shot on RED camera, shallow depth of field. 16:9 aspect ratio, 4K quality.`,
    
    fireside: `Photorealistic cinematic photo of ${names} seated around a crackling fireplace in a cozy mountain lodge, ${topicContext}. Warm flickering firelight illuminates their faces. Comfortable vintage armchairs, Persian rugs, bookshelves in the background. ${topic ? `Subtle visual references to "${topic}" in the decor - perhaps themed artwork on the walls or relevant objects on the mantle.` : ''} Snowy night visible through frosted windows. Intimate atmosphere, 4K quality.`,
    
    rooftop: `Photorealistic cinematic photo of ${names} on a trendy rooftop terrace at golden hour, ${topicContext}. City skyline glittering in the background. Modern outdoor furniture, string lights overhead, potted plants. ${topic ? `Creative incorporation of "${topic}" theme in the urban setting - perhaps relevant signage, art installations, or thematic decorations visible.` : ''} Warm sunset glow, comfortable bohemian vibes. 4K quality.`,
    
    library: `Photorealistic cinematic photo of ${names} in a grand historic library with towering bookshelves, ${topicContext}. Ornate wooden ladders, green banker's lamps, leather wingback chairs around an antique globe. ${topic ? `Books and manuscripts related to "${topic}" prominently displayed, scholarly atmosphere.` : ''} Dust motes floating in shafts of light from tall windows. Rich mahogany and warm amber tones. 4K quality.`
  };
  
  return scenePrompts[scene || 'studio'] || scenePrompts.studio;
}
