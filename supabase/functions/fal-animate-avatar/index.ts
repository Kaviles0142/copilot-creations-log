import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to upload base64 data to Supabase storage
async function base64ToUrl(base64Data: string, filename: string, bucket: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:.*?;base64,/, '');
  
  // Convert base64 to binary
  const binaryData = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
  
  // Upload to storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, binaryData, {
      contentType: bucket === 'audio-files' ? 'audio/mpeg' : 'image/png',
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, audioUrl } = await req.json();
    
    if (!imageUrl || !audioUrl) {
      throw new Error('Image URL and audio URL are required');
    }

    console.log('🎬 Animating avatar...');
    console.log('📸 Image:', imageUrl.substring(0, 50) + '...');
    console.log('🎵 Audio type:', audioUrl.startsWith('data:') ? 'base64' : audioUrl.startsWith('blob:') ? 'blob' : 'url');

    // Handle base64 or blob URLs by uploading to Supabase storage
    let finalAudioUrl = audioUrl;
    if (audioUrl.startsWith('data:') || audioUrl.startsWith('blob:')) {
      console.log('📤 Uploading audio to Supabase storage...');
      const filename = `avatar-audio-${Date.now()}.mp3`;
      
      // If it's a blob URL, fetch it first
      if (audioUrl.startsWith('blob:')) {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        finalAudioUrl = await base64ToUrl(base64, filename, 'audio-files');
      } else {
        finalAudioUrl = await base64ToUrl(audioUrl, filename, 'audio-files');
      }
      
      console.log('✅ Audio uploaded:', finalAudioUrl);
    }

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
        audio_url: finalAudioUrl,
        prompt: "Animate this portrait to speak naturally and expressively with the provided audio",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ fal.ai error:', response.status, errorText);
      throw new Error(`fal.ai animation error: ${response.status}`);
    }

    const result = await response.json();
    // fal.ai returns video as an object with url property
    const videoUrl = result.video?.url || result.video;
    
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