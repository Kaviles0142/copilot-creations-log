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
    const { sessionId, userMessage, currentTurn, selectedFigureId, startNewRound, round, figureIndexInRound } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🎭 Orchestrating debate session: ${sessionId}${startNewRound ? `, starting round ${round}` : `, turn: ${currentTurn}`}`);

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

    // If starting a new round, trigger all figures sequentially
    if (startNewRound) {
      console.log(`🔄 Starting new round ${round}`);
      
      // Update session to new round and mark as incomplete
      await supabase
        .from('debate_sessions')
        .update({ 
          current_round: round,
          is_round_complete: false 
        })
        .eq('id', sessionId);

      // Trigger first figure in the round
      const { error: triggerError } = await supabase.functions.invoke("debate-orchestrator", {
        body: {
          sessionId,
          currentTurn: (previousMessages?.length || 0),
          figureIndexInRound: 0,
          round,
        },
      });

      if (triggerError) throw triggerError;

      return new Response(
        JSON.stringify({ success: true, message: 'Round started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const userPrompt = userMessage || 'Continue the debate based on the previous points.';

    // Generate cache key from conversation context
    const cacheKey = `debate_${sessionId}_${currentFigureName}_${currentTurn}_${conversationHistory.slice(-200)}`;
    const cacheKeyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cacheKey))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Check cache first
    const { data: cachedResponse } = await supabase
      .from('ai_response_cache')
      .select('response_content, hit_count')
      .eq('cache_key', cacheKeyHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    let figureResponse: string;

    if (cachedResponse) {
      console.log(`✅ Cache hit for ${currentFigureName} (used ${cachedResponse.hit_count} times)`);
      figureResponse = cachedResponse.response_content;
      
      // Increment hit count
      await supabase
        .from('ai_response_cache')
        .update({ hit_count: cachedResponse.hit_count + 1 })
        .eq('cache_key', cacheKeyHash);
    } else {
      console.log(`🔄 Cache miss - calling OpenAI for ${currentFigureName}`);
      
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
      figureResponse = aiData.choices[0].message.content;

      // Cache the response (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase
        .from('ai_response_cache')
        .insert({
          cache_key: cacheKeyHash,
          response_content: figureResponse,
          figure_name: currentFigureName,
          ai_provider: 'openai',
          model: 'gpt-4o-mini',
          expires_at: expiresAt.toISOString(),
        });
      
      console.log(`💾 Cached response for ${currentFigureName}`);
    }

    // Save figure's response
    await supabase.from('debate_messages').insert({
      debate_session_id: sessionId,
      figure_id: currentFigureId,
      figure_name: currentFigureName,
      content: figureResponse,
      turn_number: currentTurn,
      is_user_message: false,
    });

    console.log(`✅ ${currentFigureName} responded (turn ${currentTurn})`);

    // Determine if we should continue to the next figure in this round
    const totalFigures = session.figure_names.length;
    const nextFigureIndex = (figureIndexInRound !== undefined ? figureIndexInRound : currentFigureIndex) + 1;

    if (nextFigureIndex < totalFigures && session.format !== 'moderated') {
      // Trigger next figure in the round
      console.log(`⏭️ Triggering next figure (${nextFigureIndex + 1}/${totalFigures})`);
      
      setTimeout(async () => {
        await supabase.functions.invoke("debate-orchestrator", {
          body: {
            sessionId,
            currentTurn: currentTurn + 1,
            figureIndexInRound: nextFigureIndex,
            round: session.current_round,
          },
        });
      }, 2000);
    } else if (nextFigureIndex >= totalFigures) {
      // Round complete - all figures have spoken
      console.log(`✅ Round ${session.current_round} complete`);
      
      await supabase
        .from('debate_sessions')
        .update({ is_round_complete: true })
        .eq('id', sessionId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        speaker: currentFigureName,
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