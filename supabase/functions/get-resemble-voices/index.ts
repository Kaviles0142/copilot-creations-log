import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const RESEMBLE_API_KEY = Deno.env.get('RESEMBLE_AI_API_KEY');
    if (!RESEMBLE_API_KEY) {
      throw new Error('Resemble AI API key not found');
    }

    console.log('Fetching Resemble AI voices...');

    // Fetch all voices from Resemble AI
    const response = await fetch('https://app.resemble.ai/api/v2/voices?page=1&page_size=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEMBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resemble AI API error:', response.status, errorText);
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched voices:', data);

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error fetching Resemble AI voices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
