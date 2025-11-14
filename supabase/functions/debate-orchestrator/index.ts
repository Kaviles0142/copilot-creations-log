import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, currentTurn } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🎭 Orchestrating debate session: ${sessionId}, turn: ${currentTurn}`);

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('debate_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get all previous messages for context
    const { data: previousMessages } = await supabase
      .from('debate_messages')
      .select('*')
      .eq('debate_session_id', sessionId)
      .order('turn_number', { ascending: true });

    // Build conversation history
    const conversationHistory = previousMessages?.map(msg => 
      `${msg.figure_name}: ${msg.content}`
    ).join('\n\n') || '';

    // Determine which figure should respond next
    const currentFigureIndex = currentTurn % session.figure_names.length;
    const currentFigureId = session.figure_ids[currentFigureIndex];
    const currentFigureName = session.figure_names[currentFigureIndex];

    // Build debate-aware prompt
    const otherFigures = session.figure_names.filter((_: string, i: number) => i !== currentFigureIndex);
    
    const systemPrompt = `You are ${currentFigureName} participating in a DEBATE with:
${otherFigures.map((name: string) => `- ${name}`).join('\n')}

Topic: ${session.topic}

Instructions:
- Stay in character as ${currentFigureName}
- Respond to arguments made by other participants
- Reference specific points made by other debaters
- You can agree with valid points or counter arguments you disagree with
- Keep your response focused and under 150 words
- Engage directly with the debate, not just with the user

Previous debate conversation:
${conversationHistory}

Now respond to the latest point raised.`;

    // Call AI to generate response
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage || 'Continue the debate based on the previous points.' }
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const aiData = await openAIResponse.json();
    const figureResponse = aiData.choices[0].message.content;

    // Save figure's response
    await supabase.from('debate_messages').insert({
      debate_session_id: sessionId,
      figure_id: currentFigureId,
      figure_name: currentFigureName,
      content: figureResponse,
      turn_number: currentTurn,
      is_user_message: false,
    });

    // Update session turn counter
    await supabase
      .from('debate_sessions')
      .update({ current_turn: currentTurn })
      .eq('id', sessionId);

    console.log(`✅ ${currentFigureName} responded in debate`);

    return new Response(
      JSON.stringify({ success: true, speaker: currentFigureName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in debate-orchestrator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});