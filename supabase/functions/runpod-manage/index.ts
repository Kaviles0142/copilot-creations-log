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
    const RUNPOD_API_KEY = Deno.env.get('RUNPOD_API_KEY');
    
    if (!RUNPOD_API_KEY) {
      throw new Error('RUNPOD_API_KEY not configured. Please add it to Supabase Edge Function Secrets.');
    }

    const { action, podId } = await req.json();

    if (!podId) {
      throw new Error('Pod ID is required');
    }

    const baseUrl = 'https://api.runpod.io/graphql';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
    };

    let query: string;
    let variables: Record<string, string> = { podId };

    switch (action) {
      case 'status':
        query = `
          query getPod($podId: String!) {
            pod(input: { podId: $podId }) {
              id
              name
              desiredStatus
              lastStatusChange
              gpuCount
              gpuType
              costPerHr
              uptimeSeconds
              runtime {
                uptimeInSeconds
              }
            }
          }
        `;
        break;

      case 'start':
        query = `
          mutation startPod($podId: String!) {
            podResume(input: { podId: $podId }) {
              id
              desiredStatus
            }
          }
        `;
        break;

      case 'stop':
        query = `
          mutation stopPod($podId: String!) {
            podStop(input: { podId: $podId }) {
              id
              desiredStatus
            }
          }
        `;
        break;

      case 'terminate':
        query = `
          mutation terminatePod($podId: String!) {
            podTerminate(input: { podId: $podId })
          }
        `;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`🖥️ RunPod ${action} for pod ${podId}`);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RunPod API error:', response.status, errorText);
      throw new Error(`RunPod API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ RunPod GraphQL errors:', result.errors);
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    console.log('✅ RunPod response:', JSON.stringify(result.data));

    // Format response based on action
    let formattedResponse;
    
    if (action === 'status') {
      const pod = result.data?.pod;
      formattedResponse = {
        id: pod?.id || podId,
        status: pod?.desiredStatus?.toLowerCase() || 'unknown',
        gpuType: pod?.gpuType,
        gpuCount: pod?.gpuCount,
        costPerHr: pod?.costPerHr,
        uptimeSeconds: pod?.runtime?.uptimeInSeconds || pod?.uptimeSeconds,
        name: pod?.name,
      };
    } else if (action === 'start') {
      formattedResponse = {
        id: result.data?.podResume?.id || podId,
        status: 'starting',
      };
    } else if (action === 'stop') {
      formattedResponse = {
        id: result.data?.podStop?.id || podId,
        status: 'stopping',
      };
    } else {
      formattedResponse = result.data;
    }

    return new Response(
      JSON.stringify(formattedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in runpod-manage:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
