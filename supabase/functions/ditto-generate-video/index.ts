import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ditto API endpoint - hardcoded to new RunPod endpoint
const DITTO_API_URL = 'https://kkrom2i7drv27i-8000.proxy.runpod.net';

const getDittoApiUrl = () => DITTO_API_URL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDittoStatus = (status: number) => {
  // Cloudflare / transient gateway errors (including RunPod cold start)
  return [408, 425, 429, 500, 502, 503, 504, 524].includes(status);
};

const fetchWithRetry = async (
  makeRequest: () => Promise<Response>,
  opts: { attempts: number; baseDelayMs?: number; maxDelayMs?: number; label?: string }
) => {
  const attempts = Math.max(1, opts.attempts);
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  const maxDelayMs = opts.maxDelayMs ?? 15000;
  const label = opts.label ?? 'request';

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await makeRequest();

      if (res.ok) return res;

      const retryable = isRetryableDittoStatus(res.status);
      if (!retryable || attempt === attempts) return res;

      let preview = '';
      try {
        preview = (await res.clone().text()).slice(0, 400);
      } catch {
        preview = '<unable to read body>';
      }

      console.error(`❌ Ditto ${label} retryable status ${res.status} (attempt ${attempt}/${attempts}):`, preview);

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.log(`⏳ Retrying Ditto ${label} in ${delay}ms...`);
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;

      console.error(`❌ Ditto ${label} threw (attempt ${attempt}/${attempts}):`, err);
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.log(`⏳ Retrying Ditto ${label} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Ditto request failed');
};

// Background processing function - runs after response is sent
async function processVideoGeneration(
  jobId: string,
  imageUrl: string,
  audioUrl: string,
  figureId?: string,
  figureName?: string
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔄 Background processing started for job:', jobId);
    
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
    const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());

    // Calculate estimated audio duration (assuming 16kHz WAV mono = 32000 bytes/sec)
    const estimatedDurationSec = audioBytes.length / 32000;
    console.log('⏱️ Estimated audio duration:', estimatedDurationSec.toFixed(1), 'seconds');

    const buildFormData = () => {
      const formData = new FormData();
      formData.append(
        "audio_file",
        new Blob([audioBytes], { type: "audio/wav" }),
        "audio.wav"
      );
      formData.append(
        "image_file",
        new Blob([imageBytes], { type: "image/jpeg" }),
        "portrait.jpg"
      );
      // Use TensorRT for faster processing
      formData.append("model_type", "trt");
      // Enable streaming mode for real-time video generation
      formData.append("streaming", "true");
      formData.append("fade_in", "-1");
      formData.append("fade_out", "-1");
      return formData;
    };

    console.log('📤 Sending to Ditto API with streaming + TRT...');
    await supabase
      .from("video_jobs")
      .update({ status: "generating" })
      .eq("id", jobId);

    // Scale retries and delays based on audio length
    const maxRetries = Math.max(5, Math.ceil(estimatedDurationSec / 10));
    const baseDelay = Math.max(5000, estimatedDurationSec * 200);
    const maxDelay = Math.max(30000, estimatedDurationSec * 1000);
    console.log(`⏳ Using ${maxRetries} retries, baseDelay: ${baseDelay}ms, maxDelay: ${maxDelay}ms`);
    
    const response = await fetchWithRetry(
      () => fetch(`${getDittoApiUrl()}/generate`, {
        method: "POST",
        body: buildFormData(),
      }),
      { attempts: maxRetries, baseDelayMs: baseDelay, maxDelayMs: maxDelay, label: 'generate' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ditto API error:', response.status, errorText);
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error: `Ditto API error: ${response.status}`, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
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

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        await supabase
          .from("video_jobs")
          .update({ status: "failed", error: `Upload failed: ${uploadError.message}`, updated_at: new Date().toISOString() })
          .eq("id", jobId);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("audio-files")
        .getPublicUrl(filename);

      await supabase
        .from("video_jobs")
        .update({ status: "completed", video_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      console.log('✅ Video ready:', urlData.publicUrl);
      return;
    }

    // Check if streaming response
    if (contentType.includes("text/event-stream") || contentType.includes("application/octet-stream")) {
      console.log('🌊 Streaming response detected, collecting video chunks...');
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
          console.log('📦 Received chunk:', value.length, 'bytes');
        }
      }

      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const videoBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        videoBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log('🎥 Streaming complete! Total size:', totalLength, 'bytes');
      
      const filename = `videos/${Date.now()}-${jobId}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("audio-files")
        .upload(filename, videoBuffer, {
          contentType: "video/mp4",
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        await supabase
          .from("video_jobs")
          .update({ status: "failed", error: `Upload failed: ${uploadError.message}`, updated_at: new Date().toISOString() })
          .eq("id", jobId);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("audio-files")
        .getPublicUrl(filename);

      await supabase
        .from("video_jobs")
        .update({ status: "completed", video_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      console.log('✅ Streamed video ready:', urlData.publicUrl);
      return;
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
      return;
    }

    // Unknown response
    console.error('❓ Unexpected Ditto response:', result);
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error: "Unexpected API response", updated_at: new Date().toISOString() })
      .eq("id", jobId);

  } catch (error) {
    console.error('❌ Background processing error:', error);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from("video_jobs")
      .update({ 
        status: "failed", 
        error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);
  }
}

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

    // ============ START MODE - RETURNS IMMEDIATELY ============
    const imageUrl = body.imageUrl || body.image_url;
    const audioUrl = body.audioUrl || body.audio_url;
    const figureId = body.figureId || body.figure_id;
    const figureName = body.figureName || body.figure_name;

    if (!imageUrl || !audioUrl) {
      throw new Error('Image URL and audio URL are required');
    }

    console.log('📸 Image URL:', imageUrl.substring(0, 80) + '...');
    console.log('🎵 Audio URL type:', audioUrl.startsWith('data:') ? 'base64' : 'url');

    // Create job record FIRST
    const jobId = crypto.randomUUID();
    await supabase.from("video_jobs").insert({
      id: jobId,
      status: "initiating",
      image_url: imageUrl.substring(0, 500),
      audio_url: audioUrl.substring(0, 100), // Store first 100 chars for reference
      figure_id: figureId,
      figure_name: figureName,
    });

    console.log('📝 Job created:', jobId);

    // Start background processing - THIS IS THE KEY CHANGE
    // Use globalThis.EdgeRuntime for Supabase edge functions
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === 'function') {
      runtime.waitUntil(
        processVideoGeneration(jobId, imageUrl, audioUrl, figureId, figureName)
      );
    } else {
      // Fallback: start processing without awaiting (less reliable but works)
      processVideoGeneration(jobId, imageUrl, audioUrl, figureId, figureName).catch(console.error);
    }

    // Return immediately with job ID - client will poll for status
    console.log('🚀 Returning immediately, background processing started');
    return new Response(
      JSON.stringify({ status: "processing", jobId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in ditto-generate-video:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
