import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, description, period, historicalContext } = await req.json();

    if (!figureName) {
      throw new Error('Figure name is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    console.log(`Generating portrait for: ${figureName}`);

    // Create a detailed prompt for generating a historically accurate portrait
    const prompt = `Create a highly realistic, historically accurate portrait of ${figureName}${period ? ` from ${period}` : ''}. 

    Based on historical records: ${description || 'Historical figure'}
    ${historicalContext ? `Additional context: ${historicalContext}` : ''}
    
    The portrait should be:
    - Photorealistic and dignified
    - Showing appropriate clothing and styling for their time period
    - Professional portrait composition with good lighting
    - Respectful and historically informed representation
    - High quality museum-style historical portrait
    - Neutral background that doesn't distract from the subject
    
    Style: Professional historical portrait painting converted to photorealistic style, museum quality, detailed facial features, period-appropriate attire and accessories.`;

    console.log('Generating image with OpenAI...');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
        n: 1
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Image generated successfully');

    // The gpt-image-1 model returns base64 data directly
    if (data.data && data.data[0] && data.data[0].b64_json) {
      return new Response(
        JSON.stringify({
          success: true,
          image: `data:image/png;base64,${data.data[0].b64_json}`,
          figureName: figureName
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      throw new Error('Unexpected response format from OpenAI');
    }

  } catch (error) {
    console.error('Error generating portrait:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});