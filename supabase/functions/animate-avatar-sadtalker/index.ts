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

    const { imageUrl, audioUrl } = await req.json();

    if (!imageUrl || !audioUrl) {
      return new Response(
        JSON.stringify({ error: "Missing imageUrl or audioUrl" }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log("🎬 Starting SadTalker animation...");
    console.log("📸 Image URL:", imageUrl);
    console.log("🎤 Audio URL:", audioUrl);

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Use SadTalker model - lucataco version is actively maintained
    const output = await replicate.run(
      "lucataco/sadtalker:85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b",
      {
        input: {
          source_image: imageUrl,
          driven_audio: audioUrl,
          enhancer: "gfpgan",
          preprocess: "full",
          still: true
        }
      }
    );

    console.log("✅ SadTalker animation complete!");
    console.log("📹 Video URL:", output);

    return new Response(
      JSON.stringify({ 
        videoUrl: output,
        success: true 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Error in animate-avatar-sadtalker:", error);
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
