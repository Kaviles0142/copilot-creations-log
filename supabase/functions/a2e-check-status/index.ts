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
    const { taskId } = await req.json();
    const A2E_API_KEY = Deno.env.get('A2E_API_KEY');

    if (!A2E_API_KEY) {
      throw new Error('A2E_API_KEY not configured');
    }

    const BASE_URL = 'https://video.a2e.ai';
    
    const statusResponse = await fetch(`${BASE_URL}/api/v1/talkingPhoto/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error(`❌ Status check failed: ${statusResponse.status}`, errorText);
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data?.current_status || statusData.current_status;
    const resultUrl = statusData.data?.result_url || statusData.result_url;

    console.log(`📊 Task ${taskId} status: ${status}`);

    if (status === 'completed' || status === 'success' || status === 'done') {
      if (resultUrl) {
        console.log('✅ Video ready:', resultUrl);
        return new Response(
          JSON.stringify({
            success: true,
            status: 'completed',
            videoUrl: resultUrl,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        throw new Error('Status completed but no result_url found');
      }
    } else if (status === 'failed' || status === 'error') {
      const errorMsg = statusData.data?.failed_message || statusData.failed_message || 'Unknown error';
      throw new Error(`Generation failed: ${errorMsg}`);
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          status: status || 'processing',
          videoUrl: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error) {
    console.error('❌ Error checking A2E status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check status',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
