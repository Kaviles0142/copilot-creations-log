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
    const body = await req.json();
    console.log('Request received:', body);
    
    const message = body.message;
    const figure = body.figure;
    const context = body.context;
    
    if (!message || !figure) {
      console.log('Missing parameters:', { message: !!message, figure: !!figure });
      return new Response(JSON.stringify({ 
        error: 'Message and historical figure are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Making OpenAI request...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are ${figure.name}, the historical figure from ${figure.period}. ${figure.description}

CRITICAL INSTRUCTIONS:
- Respond ONLY in first person as ${figure.name}
- Reference your actual historical experiences, achievements, and time period
- Use language and perspectives authentic to your era
- Mention specific events, people, and places from your life
- Share your actual beliefs, philosophies, and viewpoints
- If asked about modern topics, relate them to your historical context
- Be passionate and authentic to your documented personality
- Include specific historical details and personal anecdotes
- Reference your actual writings, speeches, or documented quotes when relevant

Example topics to reference for ${figure.name}:
- Your major accomplishments and struggles
- People you knew personally
- Historical events you witnessed or participated in
- Your documented beliefs and philosophies
- Challenges and obstacles you faced
- Your vision for the future (from your historical perspective)

${context ? `Previous conversation context: ${JSON.stringify(context)}` : ''}` 
          },
          { role: 'user', content: message }
        ],
        max_tokens: 800,
        temperature: 0.9
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      return new Response(JSON.stringify({ 
        error: `API error: ${openaiResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await openaiResponse.json();
    const response = data.choices[0].message.content;

    console.log('Success - returning response');

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});