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
    const { avatar_id, expire_seconds = 3600 } = await req.json();

    const A2E_API_KEY = Deno.env.get('A2E_API_KEY');
    if (!A2E_API_KEY) {
      throw new Error('A2E_API_KEY not configured');
    }

    console.log(`🎭 Getting Agora token for avatar: ${avatar_id}`);

    const response = await fetch('https://video.a2e.ai/api/v1/streaming-avatar/agora-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatar_id || '676e1f054c86ff839eae2cc3', // Default avatar if not provided
        expire_seconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ A2E API error:', response.status, errorText);
      throw new Error(`A2E API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Agora token obtained:', data);

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in a2e-get-stream-token:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
