import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to convert base64 to URL by uploading to Supabase storage
async function base64ToUrl(base64Data: string, filename: string, bucket: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract base64 content (remove data:image/png;base64, or data:audio/mp3;base64, prefix)
  const base64Content = base64Data.split(',')[1] || base64Data;
  
  // Convert base64 to binary
  const binaryData = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, binaryData, {
      contentType: filename.endsWith('.mp3') ? 'audio/mpeg' : 'image/png',
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return publicUrl;
}

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
    
    // Convert base64 to URLs if needed
    let finalImageUrl = imageUrl;
    let finalAudioUrl = audioUrl;

    if (imageUrl.startsWith('data:')) {
      console.log('📤 Uploading image to storage...');
      const timestamp = Date.now();
      finalImageUrl = await base64ToUrl(imageUrl, `sadtalker/image-${timestamp}.png`, 'audio-files');
      console.log('📸 Image URL:', finalImageUrl);
    }

    if (audioUrl.startsWith('data:') || audioUrl.startsWith('//')) {
      console.log('📤 Uploading audio to storage...');
      const timestamp = Date.now();
      // Handle base64 audio from Azure TTS
      const audioBase64 = audioUrl.startsWith('//') ? audioUrl : audioUrl.split(',')[1];
      finalAudioUrl = await base64ToUrl(`data:audio/mpeg;base64,${audioBase64}`, `sadtalker/audio-${timestamp}.mp3`, 'audio-files');
      console.log('🎤 Audio URL:', finalAudioUrl);
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Use SadTalker model - lucataco version is actively maintained
    const output = await replicate.run(
      "lucataco/sadtalker:85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b",
      {
        input: {
          source_image: finalImageUrl,
          driven_audio: finalAudioUrl,
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
