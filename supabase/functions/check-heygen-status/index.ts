import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    const HEYGEN_API_KEY = Deno.env.get('HEYGEN_API_KEY');
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    const videoStatusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
      }
    });

    if (!videoStatusResponse.ok) {
      throw new Error('Failed to check video status');
    }

    const videoStatusData = await videoStatusResponse.json();
    const status = videoStatusData.data?.status;
    const videoUrl = videoStatusData.data?.video_url;

    console.log(`Video ${videoId} status: ${status}`);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        videoUrl: status === 'completed' ? videoUrl : null,
        videoId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in check-heygen-status:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
