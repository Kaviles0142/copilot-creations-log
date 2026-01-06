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
    const { figures } = await req.json();

    if (!figures || !Array.isArray(figures) || figures.length === 0) {
      throw new Error('figures array is required');
    }

    console.log('🎙️ Generating podcast scene for:', figures);

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create a stable cache key from sorted figure names
    const sortedFigures = [...figures].sort();
    const cacheKey = `podcast-${sortedFigures.map(f => f.toLowerCase().replace(/\s+/g, '-')).join('-')}`;
    
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

    // Build a concise, focused prompt based on participant count
    const prompt = buildPodcastPrompt(figures);
    console.log('📝 Prompt length:', prompt.length, 'chars');

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
    
    const fileName = `${cacheKey}-${Date.now()}.png`;
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

    // Cache the result (use upsert to handle duplicates)
    const { error: cacheInsertError } = await supabase
      .from('avatar_image_cache')
      .upsert({
        figure_id: cacheKey,
        figure_name: `Podcast: ${figures.join(', ')}`,
        cloudinary_url: publicUrl,
        visual_prompt: prompt.substring(0, 500), // Truncate for storage
      }, { onConflict: 'figure_id' });

    if (cacheInsertError) {
      console.error('⚠️ Cache insert warning:', cacheInsertError);
    } else {
      console.log('✅ Cached successfully');
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

function buildPodcastPrompt(figures: string[]): string {
  const count = figures.length;
  const names = figures.join(', ');
  
  // Keep prompt concise but descriptive
  if (count === 1) {
    return `Photorealistic photo of ${figures[0]} in a podcast studio. They sit in a leather chair with a professional microphone. Warm studio lighting, acoustic panels behind. High quality, 4K.`;
  }
  
  if (count === 2) {
    return `Photorealistic photo of ${figures[0]} and ${figures[1]} sitting together on a couch in a modern podcast studio. Each has a microphone. They face each other in conversation. Warm lighting, acoustic panels. 4K quality.`;
  }
  
  if (count <= 4) {
    return `Photorealistic group photo of ${names} sitting together on a large sectional sofa in a podcast studio. Each person has a microphone. Semi-circle arrangement facing camera. Warm Edison lighting, exposed brick, acoustic panels. 4K.`;
  }
  
  // For 5+ people, keep it simple to avoid prompt overload
  return `Photorealistic wide shot of ${count} famous people (${names}) sitting together on a curved sectional couch in a professional podcast studio. Each has a microphone. Warm studio lighting. 4K quality, group portrait.`;
}
