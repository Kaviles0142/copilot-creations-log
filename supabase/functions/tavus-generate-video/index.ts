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
    const { script, replica_id } = await req.json();
    
    if (!script) {
      throw new Error('Script text is required');
    }

    const TAVUS_API_KEY = Deno.env.get('TAVUS_API_KEY');
    if (!TAVUS_API_KEY) {
      throw new Error('TAVUS_API_KEY not configured');
    }

    console.log('📹 Generating Tavus video for script:', script.substring(0, 50) + '...');

    // Generate video using Tavus API
    const response = await fetch('https://tavusapi.com/v2/videos', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        replica_id: replica_id || 'default', // Use provided replica or default
        script: script,
        background_url: null, // Can customize background
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Tavus API error:', response.status, errorText);
      throw new Error(`Tavus API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Tavus video generated:', data.video_id);

    // Poll for video completion
    const videoId = data.video_id;
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://tavusapi.com/v2/videos/${videoId}`, {
        headers: {
          'x-api-key': TAVUS_API_KEY,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log(`📊 Video status (attempt ${attempts + 1}):`, statusData.status);
        
        if (statusData.status === 'completed' && statusData.download_url) {
          videoUrl = statusData.download_url;
        } else if (statusData.status === 'error') {
          throw new Error('Video generation failed');
        }
      }
      
      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out');
    }

    return new Response(
      JSON.stringify({ 
        videoUrl,
        videoId 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('❌ Error in tavus-generate-video:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
