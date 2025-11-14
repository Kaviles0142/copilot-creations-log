import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to pick most relevant figure for free-for-all mode
async function pickRelevantFigure(session: any, conversationHistory: string, previousMessages: any[]): Promise<number> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) return 0;

  // If no messages yet, start with first figure
  if (!previousMessages || previousMessages.length === 0) return 0;

  const lastSpeaker = previousMessages[previousMessages.length - 1]?.figure_name;
  const availableFigures = session.figure_names.filter((name: string) => name !== lastSpeaker);

  const prompt = `Given this debate conversation:

${conversationHistory}

Topic: ${session.topic}

Available figures who haven't just spoken: ${availableFigures.join(', ')}

Who should respond next based on the conversation context? Reply with ONLY the name from the available figures list.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const selectedName = data.choices[0].message.content.trim();
      const index = session.figure_names.indexOf(selectedName);
      return index >= 0 ? index : 0;
    }
  } catch (error) {
    console.error('Error picking figure:', error);
  }

  return 0; // Fallback to first figure
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, currentTurn, selectedFigureId } = await req.json();

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

    let currentFigureId: string;
    let currentFigureName: string;
    let currentFigureIndex: number;

    // Determine next speaker based on format
    if (session.format === 'moderated' && selectedFigureId) {
      // Moderated: User selected specific figure
      currentFigureIndex = session.figure_ids.indexOf(selectedFigureId);
      currentFigureId = selectedFigureId;
      currentFigureName = session.figure_names[currentFigureIndex];
    } else if (session.format === 'free-for-all') {
      // Free-for-all: AI picks most relevant figure
      currentFigureIndex = await pickRelevantFigure(session, conversationHistory, previousMessages || []);
      currentFigureId = session.figure_ids[currentFigureIndex];
      currentFigureName = session.figure_names[currentFigureIndex];
    } else {
      // Round-robin: Sequential order
      currentFigureIndex = currentTurn % session.figure_names.length;
      currentFigureId = session.figure_ids[currentFigureIndex];
      currentFigureName = session.figure_names[currentFigureIndex];
    }

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
      .update({ current_turn: currentTurn + 1 })
      .eq('id', sessionId);

    console.log(`✅ ${currentFigureName} responded (turn ${currentTurn})`);

    // Don't use setTimeout in edge functions - it won't work
    // Instead, return a flag indicating whether to continue
    const recentMessages = previousMessages?.slice(-3) || [];
    const consecutiveAiTurns = recentMessages.filter((m: any) => !m.is_user_message).length;
    const shouldContinue = session.format !== 'moderated' && consecutiveAiTurns < 3 && !userMessage;

    return new Response(
      JSON.stringify({ 
        success: true, 
        speaker: currentFigureName,
        shouldContinue,
        nextTurn: currentTurn + 1
      }),
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