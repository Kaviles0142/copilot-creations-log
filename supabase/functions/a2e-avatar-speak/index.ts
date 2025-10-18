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
    const { channel, text } = await req.json();

    if (!channel || !text) {
      throw new Error('Channel and text are required');
    }

    const A2E_API_KEY = Deno.env.get('A2E_API_KEY');
    if (!A2E_API_KEY) {
      throw new Error('A2E_API_KEY not configured');
    }

    console.log(`🗣️ Making avatar speak on channel: ${channel}`);
    console.log(`📝 Text: ${text.substring(0, 100)}...`);

    const response = await fetch('https://video.a2e.ai/api/v1/streaming-avatar/speak', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ A2E speak API error:', response.status, errorText);
      throw new Error(`A2E speak API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Avatar speaking command sent');

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in a2e-avatar-speak:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
