import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, audioUrl } = await req.json();
    
    if (!imageUrl || !audioUrl) {
      throw new Error('Image URL and audio URL are required');
    }

    console.log('🎬 Animating avatar...');
    console.log('📸 Image:', imageUrl);
    console.log('🎵 Audio:', audioUrl);

    const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY not configured');
    }

    // Generate video using fal.ai AI Avatar
    const response = await fetch('https://fal.run/fal-ai/ai-avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        audio_url: audioUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ fal.ai error:', response.status, errorText);
      throw new Error(`fal.ai animation error: ${response.status}`);
    }

    const result = await response.json();
    const videoUrl = result.video;
    
    console.log('✅ Video generated:', videoUrl);

    return new Response(
      JSON.stringify({ videoUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in fal-animate-avatar:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
