import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ditto API endpoint - read from environment variable
const getDittoApiUrl = () => {
  const url = Deno.env.get('DITTO_API_URL');
  if (!url) {
    throw new Error('DITTO_API_URL environment variable is not set');
  }
  return url.replace(/\/$/, ''); // Remove trailing slash if present
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const action = body?.action || "start";

    console.log('🎬 Ditto Video Generation - Action:', action);

    // ============ STATUS CHECK MODE ============
    if (action === "status") {
      const jobId = body.jobId;
      console.log('📊 Checking status for job:', jobId);

      const { data: jobData, error: jobError } = await supabase
        .from("video_jobs")
        .select("status, video_url, error, ditto_request_id")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error('❌ Job lookup error:', jobError);
        return new Response(JSON.stringify({ status: "error", error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (jobData?.status === "completed") {
        console.log('✅ Job completed, returning video URL');
        return new Response(JSON.stringify({ status: "completed", video: jobData.video_url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (jobData?.status === "failed") {
        console.log('❌ Job failed:', jobData.error);
        return new Response(JSON.stringify({ status: "failed", error: jobData.error }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Poll Ditto if we have a request_id
      if (jobData?.ditto_request_id) {
        console.log('🔄 Polling Ditto for request:', jobData.ditto_request_id);
        
        try {
          const response = await fetch(`${getDittoApiUrl()}/download/${jobData.ditto_request_id}`);
          const contentType = response.headers.get("content-type") || "";

          if (contentType.includes("video")) {
            console.log('🎥 Video ready! Uploading to storage...');
            const videoBuffer = await response.arrayBuffer();
            const videoData = new Uint8Array(videoBuffer);
            const filename = `videos/${Date.now()}-${jobId}.mp4`;

            const { error: uploadError } = await supabase.storage
              .from("audio-files")
              .upload(filename, videoData, {
                contentType: "video/mp4",
                upsert: true,
              });

            if (uploadError) {
              console.error('❌ Video upload error:', uploadError);
              throw uploadError;
            }

            const { data: urlData } = supabase.storage
              .from("audio-files")
              .getPublicUrl(filename);

            await supabase
              .from("video_jobs")
              .update({ status: "completed", video_url: urlData.publicUrl, updated_at: new Date().toISOString() })
              .eq("id", jobId);

            console.log('✅ Video uploaded and job completed:', urlData.publicUrl);
            return new Response(JSON.stringify({ status: "completed", video: urlData.publicUrl }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (pollError) {
          console.log('⏳ Still processing or poll error:', pollError);
        }
      }

      return new Response(JSON.stringify({ status: "processing" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ START MODE ============
    const imageUrl = body.imageUrl || body.image_url;
    const audioUrl = body.audioUrl || body.audio_url;
    const figureId = body.figureId || body.figure_id;
    const figureName = body.figureName || body.figure_name;

    if (!imageUrl || !audioUrl) {
      throw new Error('Image URL and audio URL are required');
    }

    console.log('📸 Image URL:', imageUrl.substring(0, 80) + '...');
    console.log('🎵 Audio URL type:', audioUrl.startsWith('data:') ? 'base64' : 'url');

    // Create job record
    const jobId = crypto.randomUUID();
    await supabase.from("video_jobs").insert({
      id: jobId,
      status: "initiating",
      image_url: imageUrl.substring(0, 500),
      figure_id: figureId,
      figure_name: figureName,
    });

    console.log('📝 Job created:', jobId);

    // Fetch image
    console.log('⬇️ Fetching image...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    console.log('✅ Image fetched, size:', imageBlob.size);

    // Handle audio - convert base64 to blob if needed
    let audioBlob: Blob;
    if (audioUrl.startsWith('data:')) {
      console.log('🔄 Converting base64 audio to blob...');
      const base64Data = audioUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // Determine content type from data URL
      const mimeMatch = audioUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';
      audioBlob = new Blob([bytes], { type: mimeType });
      console.log('✅ Audio converted, size:', audioBlob.size, 'type:', mimeType);
    } else {
      console.log('⬇️ Fetching audio from URL...');
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }
      audioBlob = await audioResponse.blob();
      console.log('✅ Audio fetched, size:', audioBlob.size);
    }

    // Build multipart form - CRITICAL: audio first, then image (as per Ditto API)
    const formData = new FormData();
    formData.append("audio_file", new Blob([await audioBlob.arrayBuffer()], { type: "audio/wav" }), "audio.wav");
    formData.append("image_file", new Blob([await imageBlob.arrayBuffer()], { type: "image/jpeg" }), "portrait.jpg");
    formData.append("model_type", "trt"); // TensorRT for faster processing
    formData.append("fade_in", "-1");
    formData.append("fade_out", "-1");

    console.log('📤 Sending to Ditto API...');
    await supabase
      .from("video_jobs")
      .update({ status: "generating" })
      .eq("id", jobId);

    // Call Ditto generate endpoint
    const response = await fetch(`${getDittoApiUrl()}/generate`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ditto API error:', response.status, errorText);
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error: `Ditto API error: ${response.status}` })
        .eq("id", jobId);
      throw new Error(`Ditto API error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    console.log('📨 Ditto response content-type:', contentType);

    // Check if video returned directly (synchronous response)
    if (contentType.includes("video")) {
      console.log('🎥 Video returned directly! Uploading to storage...');
      const videoBuffer = await response.arrayBuffer();
      const filename = `videos/${Date.now()}-${jobId}.mp4`;
      
      const { error: uploadError } = await supabase.storage
        .from("audio-files")
        .upload(filename, new Uint8Array(videoBuffer), {
          contentType: "video/mp4",
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("audio-files")
        .getPublicUrl(filename);

      await supabase
        .from("video_jobs")
        .update({ status: "completed", video_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      console.log('✅ Video ready:', urlData.publicUrl);
      return new Response(
        JSON.stringify({ status: "completed", jobId, video: urlData.publicUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Async response - store request_id for polling
    const result = await response.json();
    console.log('📋 Ditto async response:', result);

    if (result.request_id) {
      await supabase
        .from("video_jobs")
        .update({ 
          status: "processing", 
          ditto_request_id: result.request_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      console.log('⏳ Video processing started, request_id:', result.request_id);
      return new Response(
        JSON.stringify({ status: "processing", jobId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown response
    console.error('❓ Unexpected Ditto response:', result);
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error: "Unexpected API response" })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ status: "error", error: "Unexpected API response", jobId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in ditto-generate-video:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
