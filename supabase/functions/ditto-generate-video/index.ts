import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RunPod InfiniteTalk API endpoint
const RUNPOD_API_URL = 'https://api.runpod.ai/v2/h1iotgppuh4nvm';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Background processing function - uses RunPod InfiniteTalk API
async function processVideoGeneration(
  jobId: string,
  imageUrl: string,
  audioUrl: string,
  figureId?: string,
  figureName?: string
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const runpodApiKey = Deno.env.get('RUNPOD_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔄 Background processing started for job:', jobId);
    
    // Handle image URL - upload to storage if it's a data URL
    let publicImageUrl = imageUrl;
    if (imageUrl.startsWith('data:')) {
      console.log('📤 Uploading image to storage...');
      const base64Data = imageUrl.split(',')[1];
      const mimeMatch = imageUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const filename = `images/${Date.now()}-${jobId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filename, bytes, { contentType: mimeType, upsert: true });
      
      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(filename);
      publicImageUrl = urlData.publicUrl;
      console.log('✅ Image uploaded:', publicImageUrl);
    }

    // Handle audio URL - upload to storage if it's a data URL
    let publicAudioUrl = audioUrl;
    if (audioUrl.startsWith('data:')) {
      console.log('📤 Uploading audio to storage...');
      const base64Data = audioUrl.split(',')[1];
      const mimeMatch = audioUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';
      const ext = mimeType.includes('mp3') ? 'mp3' : 'wav';
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const filename = `audio/${Date.now()}-${jobId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filename, bytes, { contentType: mimeType, upsert: true });
      
      if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(filename);
      publicAudioUrl = urlData.publicUrl;
      console.log('✅ Audio uploaded:', publicAudioUrl);
    }

    console.log('📸 Image URL:', publicImageUrl);
    console.log('🎵 Audio URL:', publicAudioUrl);

    // Update job status
    await supabase
      .from("video_jobs")
      .update({ status: "generating" })
      .eq("id", jobId);

    // Call RunPod InfiniteTalk API - Image-to-Video Single Person
    console.log('📤 Sending to RunPod InfiniteTalk API...');
    const runpodPayload = {
      input: {
        input_type: "image",
        person_count: "single",
        prompt: `${figureName || 'A person'} speaking naturally and expressively`,
        image_url: publicImageUrl,
        wav_url: publicAudioUrl,
        width: 512,
        height: 512,
      }
    };

    console.log('📋 RunPod payload:', JSON.stringify(runpodPayload, null, 2));

    const response = await fetch(`${RUNPOD_API_URL}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runpodApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runpodPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RunPod API error:', response.status, errorText);
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error: `RunPod API error: ${response.status}`, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    const result = await response.json();
    console.log('📋 RunPod response:', JSON.stringify(result));

    // RunPod returns { id, status } for async jobs
    const runpodJobId = result.id;
    if (!runpodJobId) {
      throw new Error('No job ID returned from RunPod');
    }

    console.log('⏳ RunPod job started:', runpodJobId);

    // Store RunPod job ID for polling
    await supabase
      .from("video_jobs")
      .update({ 
        status: "processing", 
        ditto_request_id: runpodJobId, // Reusing this field for RunPod job ID
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);

    // Poll for completion
    const maxAttempts = 120; // 10 minutes max
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Polling RunPod (attempt ${attempt}/${maxAttempts})...`);
      
      await sleep(5000); // Wait 5 seconds between polls

      const statusResponse = await fetch(`${RUNPOD_API_URL}/status/${runpodJobId}`, {
        headers: {
          'Authorization': `Bearer ${runpodApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('❌ RunPod status check failed:', statusResponse.status);
        continue;
      }

      const statusResult = await statusResponse.json();
      console.log('📊 RunPod status:', statusResult.status);

      if (statusResult.status === 'COMPLETED') {
        console.log('✅ RunPod job completed!');
        
        // Extract video from output
        const output = statusResult.output;
        let videoData: string | null = null;

        if (output?.video) {
          videoData = output.video;
        } else if (output?.video_path) {
          // If network_volume was used
          videoData = output.video_path;
        }

        if (!videoData) {
          throw new Error('No video data in RunPod response');
        }

        // If video is base64, upload to storage
        let videoUrl = videoData;
        if (videoData.startsWith('data:video')) {
          console.log('📤 Uploading video to storage...');
          const base64Data = videoData.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const filename = `videos/${Date.now()}-${jobId}.mp4`;
          const { error: uploadError } = await supabase.storage
            .from('audio-files')
            .upload(filename, bytes, { contentType: 'video/mp4', upsert: true });

          if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);

          const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(filename);
          videoUrl = urlData.publicUrl;
        }

        await supabase
          .from("video_jobs")
          .update({ status: "completed", video_url: videoUrl, updated_at: new Date().toISOString() })
          .eq("id", jobId);

        console.log('✅ Video ready:', videoUrl);
        return;
      }

      if (statusResult.status === 'FAILED') {
        console.error('❌ RunPod job failed:', statusResult.error);
        await supabase
          .from("video_jobs")
          .update({ status: "failed", error: statusResult.error || 'RunPod job failed', updated_at: new Date().toISOString() })
          .eq("id", jobId);
        return;
      }

      // Status is IN_QUEUE or IN_PROGRESS - continue polling
    }

    // Timeout
    console.error('⏰ RunPod job timed out');
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error: "Video generation timed out", updated_at: new Date().toISOString() })
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

    console.log('🎬 RunPod Video Generation - Action:', action);

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
      audio_url: audioUrl.substring(0, 100),
      figure_id: figureId,
      figure_name: figureName,
    });

    console.log('📝 Job created:', jobId);

    // Start background processing
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === 'function') {
      runtime.waitUntil(
        processVideoGeneration(jobId, imageUrl, audioUrl, figureId, figureName)
      );
    } else {
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
