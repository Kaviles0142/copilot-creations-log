import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figures, topic, mode, conversationHistory = [], currentSpeakerIndex = 0 } = await req.json();

    if (!figures || !Array.isArray(figures) || figures.length === 0) {
      throw new Error('figures array is required');
    }
    if (!topic) {
      throw new Error('topic is required');
    }

    console.log(`🎙️ Room orchestrator - Mode: ${mode}, Topic: ${topic}, Figures: ${figures.join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Select the next speaker
    const speakerIndex = currentSpeakerIndex % figures.length;
    const currentSpeaker = figures[speakerIndex];
    const figureId = currentSpeaker.toLowerCase().replace(/\s+/g, '-');

    // Build conversation context
    const recentMessages = conversationHistory.slice(-10);
    const conversationContext = recentMessages.length > 0
      ? recentMessages.map((m: any) => `${m.speakerName}: ${m.content}`).join('\n')
      : '';

    // Build system prompt based on mode
    const systemPrompt = mode === 'podcast' 
      ? `You are ${currentSpeaker}, a guest on a podcast discussing "${topic}". 
         
         Guidelines:
         - Speak naturally as yourself with your unique perspective and expertise
         - Reference your real experiences, achievements, and historical context
         - Engage with what other speakers have said if there's conversation history
         - Keep responses conversational (2-4 sentences typically)
         - Ask thought-provoking questions occasionally to keep the discussion flowing
         - Be insightful but accessible
         
         ${conversationContext ? `Recent conversation:\n${conversationContext}` : 'You are starting the discussion.'}`
      : `You are ${currentSpeaker}, participating in a formal debate on "${topic}".
         
         Guidelines:
         - Present your perspective forcefully but respectfully
         - Reference your real experiences, achievements, and historical context
         - Directly respond to and challenge points made by other debaters
         - Support your arguments with examples from your expertise
         - Keep responses focused (2-4 sentences typically)
         - Maintain your intellectual position while acknowledging valid counterpoints
         
         ${conversationContext ? `Recent debate:\n${conversationContext}` : 'You are giving your opening statement.'}`;

    // Call Lovable AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationHistory.length === 0 
            ? `Start the ${mode} by sharing your initial thoughts on "${topic}".`
            : `Continue the ${mode}. Respond to the previous points or add your perspective.`
          }
        ],
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please wait a moment' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI error: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log(`✅ ${currentSpeaker} says: ${content.substring(0, 100)}...`);

    return new Response(JSON.stringify({
      speakerName: currentSpeaker,
      figureId,
      content,
      nextSpeakerIndex: (speakerIndex + 1) % figures.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
