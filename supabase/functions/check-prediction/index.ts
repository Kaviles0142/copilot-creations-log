import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set');
    }

    const { predictionId } = await req.json();

    if (!predictionId) {
      return new Response(
        JSON.stringify({ error: "Missing predictionId" }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log("🔍 Checking prediction status:", predictionId);

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const prediction = await replicate.predictions.get(predictionId);

    console.log("📊 Prediction status:", prediction.status);
    
    if (prediction.status === 'succeeded') {
      console.log("✅ Video ready:", prediction.output);
    } else if (prediction.status === 'failed') {
      console.error("❌ Prediction failed:", prediction.error);
    }

    return new Response(
      JSON.stringify({ 
        status: prediction.status,
        output: prediction.output,
        error: prediction.error
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Error checking prediction:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(error)
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
