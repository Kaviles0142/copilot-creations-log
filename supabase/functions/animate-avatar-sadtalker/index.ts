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
    console.log("📸 Incoming image:", imageUrl.substring(0, 100));
    console.log("🎤 Incoming audio:", audioUrl.substring(0, 100));
    
    // Convert base64/blob to URLs by uploading to storage
    let finalImageUrl = imageUrl;
    let finalAudioUrl = audioUrl;

    // Handle image upload
    if (imageUrl.startsWith('data:')) {
      console.log('📤 Uploading image to storage...');
      const timestamp = Date.now();
      finalImageUrl = await base64ToUrl(imageUrl, `sadtalker/image-${timestamp}.png`, 'audio-files');
      console.log('✅ Image uploaded:', finalImageUrl);
    }

    // Handle audio upload - must convert blob/base64 to real URL
    if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
      console.log('📤 Audio needs upload (blob or base64 detected)');
      const timestamp = Date.now();
      
      // If it's base64 audio from Azure (starts with //)
      if (audioUrl.startsWith('//')) {
        const audioBase64 = audioUrl;
        finalAudioUrl = await base64ToUrl(`data:audio/mpeg;base64,${audioBase64}`, `sadtalker/audio-${timestamp}.mp3`, 'audio-files');
      } 
      // If it's a blob URL, we can't access it server-side - client must send base64
      else {
        throw new Error('Audio must be provided as base64 or HTTP URL, blob URLs are not supported');
      }
      console.log('✅ Audio uploaded:', finalAudioUrl);
    }

    console.log('🚀 Final URLs for Replicate:');
    console.log('📸 Image:', finalImageUrl);
    console.log('🎤 Audio:', finalAudioUrl);

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Use SadTalker model with predictions.create for async processing
    console.log('🎬 Creating Replicate prediction...');
    const prediction = await replicate.predictions.create({
      version: "85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b",
      input: {
        source_image: finalImageUrl,
        driven_audio: finalAudioUrl,
        enhancer: "gfpgan",
        preprocess: "full",
        still: false,
        expression_scale: 1.2,
        size: 512,
        face_model_resolution: 512
      }
    });

    console.log("✅ Prediction created:", prediction.id);
    console.log("⏳ Status:", prediction.status);

    // Return prediction ID immediately - client will poll for completion
    return new Response(
      JSON.stringify({ 
        predictionId: prediction.id,
        status: prediction.status,
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
