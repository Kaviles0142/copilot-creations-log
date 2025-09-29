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
    const { message, historicalFigure, conversationHistory } = await req.json();
    
    if (!message || !historicalFigure) {
      throw new Error('Message and historical figure are required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build conversation history for context
    const messages = [
      {
        role: "system",
        content: `You are ${historicalFigure.name}, a historical figure from ${historicalFigure.period}. 
        
        Background: ${historicalFigure.description}
        
        Instructions:
        - Respond as if you are truly this historical figure
        - Use language and perspectives appropriate to your time period
        - Draw from your actual historical knowledge, experiences, and documented views
        - Be authentic to your character's personality, beliefs, and way of speaking
        - Reference events, people, and concepts from your era when relevant
        - If asked about modern concepts unknown in your time, respond with curiosity and relate it to what you would know
        - Maintain your historical perspective while being engaging and educational
        - Keep responses conversational but informative`
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: "user",
        content: message
      }
    ];

    console.log('Sending request to OpenAI with messages:', JSON.stringify(messages, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);
    
    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-historical-figure function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});