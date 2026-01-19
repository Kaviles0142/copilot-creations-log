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
    const { topic, mode } = await req.json();

    if (!topic || typeof topic !== 'string') {
      throw new Error('Topic is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const modeContext = mode === 'debate' 
      ? 'a formal debate' 
      : 'a podcast discussion';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a title editor. Given a rough topic idea, transform it into a clean, professional title suitable for ${modeContext}. Rules:
- Keep it concise (max 10 words)
- Use title case
- Make it engaging but professional
- If it's a question, keep it as a question
- If it's a statement/topic, make it punchy
- Don't add quotes or punctuation at the end unless it's a question
- Return ONLY the formatted title, nothing else`
          },
          {
            role: 'user',
            content: topic
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      // Fallback: just return the original topic capitalized
      return new Response(JSON.stringify({ 
        formattedTopic: topic.trim()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const formattedTopic = data.choices?.[0]?.message?.content?.trim() || topic.trim();

    return new Response(JSON.stringify({ formattedTopic }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error formatting topic:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
