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

    console.log('⚔️ Generating debate scene for:', figures, 'Topic:', topic, 'Scene:', scene);

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create a cache key including topic and scene for unique images
    const sortedFigures = [...figures].sort();
    const topicSlug = (topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const sceneId = scene || 'senate';
    const cacheKey = `debate-${sceneId}-${topicSlug}-${sortedFigures.map(f => f.toLowerCase().replace(/\s+/g, '-')).join('-')}`;
    
    // Check cache first
    console.log('🔍 Checking cache for:', cacheKey);
    const { data: cachedResults, error: cacheError } = await supabase
      .from('avatar_image_cache')
      .select('*')
      .eq('figure_id', cacheKey)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cacheError && cachedResults && cachedResults.length > 0) {
      console.log('✅ Using cached debate scene from:', cachedResults[0].created_at);
      return new Response(JSON.stringify({
        imageUrl: cachedResults[0].cloudinary_url,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎨 No cache found, generating new debate scene...');

    // Build creative prompt with topic incorporated
    const prompt = buildDebatePrompt(figures, topic, sceneId);
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
        figure_name: `Debate: ${figures.join(', ')}`,
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

function buildDebatePrompt(figures: string[], topic?: string, scene?: string): string {
  const names = figures.join(' versus ');
  const topicContext = topic ? `debating "${topic}"` : 'in heated intellectual debate';
  
  // Scene-specific settings with creative topic integration
  const scenePrompts: Record<string, string> = {
    senate: `Photorealistic epic cinematic photo of ${names} ${topicContext} in an ancient Roman senate chamber. Marble columns, dramatic torchlight casting long shadows, senators in togas watching from tiered seats. ${topic ? `Symbolic representations of "${topic}" carved into the marble walls and pedestals.` : ''} Dramatic chiaroscuro lighting, tension palpable. Shot like Gladiator, 16:9 aspect ratio, 4K quality.`,
    
    colosseum: `Photorealistic epic cinematic photo of ${names} facing off in a Roman colosseum arena, ${topicContext}. Crowds in the stands, sand beneath their feet, dramatic sunset sky. ${topic ? `Banners and shields bearing symbols related to "${topic}" decorating the arena.` : ''} Gladiatorial intensity without weapons, intellectual combat. Epic scale, dramatic lighting, 4K quality.`,
    
    courtroom: `Photorealistic cinematic photo of ${names} in a grand Supreme Court chamber, ${topicContext}. Imposing marble columns, American flags, mahogany benches, dramatic judicial lighting. ${topic ? `Legal documents and evidence related to "${topic}" visible on the tables.` : ''} High stakes atmosphere, wood-paneled gravitas. Shot like a legal thriller, 4K quality.`,
    
    theatre: `Photorealistic epic cinematic photo of ${names} standing on an ancient Greek amphitheatre stage, ${topicContext}. Stone semicircle of seats rising behind them, Mediterranean sea visible in the distance, golden hour lighting. ${topic ? `Theatrical masks and props representing "${topic}" decorating the orchestra.` : ''} Classical tragedy meets intellectual discourse. Dramatic atmosphere, 4K quality.`
  };
  
  return scenePrompts[scene || 'senate'] || scenePrompts.senate;
}
