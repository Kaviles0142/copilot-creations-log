import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get language name
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ja': 'Japanese', 'zh': 'Chinese',
    'ko': 'Korean', 'ar': 'Arabic', 'ru': 'Russian', 'hi': 'Hindi'
  };
  return languages[code] || 'English';
}

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
      const selectedName = data.choices[0].message.content.trim().toLowerCase();
      
      // Case-insensitive name matching
      const index = session.figure_names.findIndex((name: string) => 
        name.toLowerCase() === selectedName
      );
      
      console.log(`🎯 AI selected: "${selectedName}", matched index: ${index}`);
      
      // If no match found, pick random available figure (not the last speaker)
      if (index < 0) {
        const randomIndex = Math.floor(Math.random() * availableFigures.length);
        const randomFigure = availableFigures[randomIndex];
        const fallbackIndex = session.figure_names.findIndex((name: string) => 
          name.toLowerCase() === randomFigure.toLowerCase()
        );
        console.log(`⚠️ No match found, using random available figure: ${randomFigure} at index ${fallbackIndex}`);
        return fallbackIndex >= 0 ? fallbackIndex : 0;
      }
      
      return index;
    }
  } catch (error) {
    console.error('Error picking figure:', error);
  }

  // Fallback: pick random from available figures
  const randomIndex = Math.floor(Math.random() * availableFigures.length);
  const randomFigure = availableFigures[randomIndex];
  const fallbackIndex = session.figure_names.findIndex((name: string) => 
    name.toLowerCase() === randomFigure.toLowerCase()
  );
  return fallbackIndex >= 0 ? fallbackIndex : 0;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, currentTurn, selectedFigureId, startNewRound, round, figureIndexInRound, language } = await req.json();

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
      // Round-robin: Use figureIndexInRound if provided, otherwise calculate from turn
      if (figureIndexInRound !== undefined) {
        currentFigureIndex = figureIndexInRound;
      } else {
        // For the start of a round, figure out position based on messages in current round
        const messagesInCurrentRound = previousMessages?.filter(m => {
          // Assuming each round has session.figure_names.length messages
          const roundStartTurn = (session.current_round - 1) * session.figure_names.length;
          return m.turn_number >= roundStartTurn;
        }).length || 0;
        currentFigureIndex = messagesInCurrentRound % session.figure_names.length;
      }
      currentFigureId = session.figure_ids[currentFigureIndex];
      currentFigureName = session.figure_names[currentFigureIndex];
    }

    // Build debate-aware prompt
    const otherFigures = session.figure_names.filter((_: string, i: number) => i !== currentFigureIndex);
    
    // Determine if this is the first speaker based on format
    let isFirstSpeaker = false;
    
    if (session.format === 'round-robin') {
      // For round-robin: First speaker in the current round
      const messagesInCurrentRound = previousMessages?.filter(m => {
        const roundStartTurn = (session.current_round - 1) * session.figure_names.length;
        return m.turn_number >= roundStartTurn;
      }).length || 0;
      isFirstSpeaker = messagesInCurrentRound === 0;
    } else {
      // For free-for-all and moderated: First speaker in the entire session
      isFirstSpeaker = !previousMessages || previousMessages.length === 0;
    }
    
    let systemPrompt: string;
    let userPrompt: string;
    
    if (isFirstSpeaker) {
      // First speaker: Give fresh opinion without referencing others
      systemPrompt = `You are ${currentFigureName} participating in a DEBATE with:
${otherFigures.map((name: string) => `- ${name}`).join('\n')}

Topic: ${session.topic}

Instructions:
- Stay in character as ${currentFigureName}
- Give your perspective and opinion on the topic
- DO NOT reference or respond to other participants (they haven't spoken yet)
- Present your viewpoint clearly and thoughtfully
- Keep your response focused and under 150 words
${language && language !== 'en' ? `- CRITICAL: Respond ONLY in ${getLanguageName(language)}. Do not use English.` : ''}

Share your opinion on the topic above.`;

      userPrompt = userMessage || `What is your perspective on: ${session.topic}`;
    } else {
      // Subsequent speakers: Respond to what others have said
      systemPrompt = `You are ${currentFigureName} participating in a DEBATE with:
${otherFigures.map((name: string) => `- ${name}`).join('\n')}

Topic: ${session.topic}

Instructions:
- Stay in character as ${currentFigureName}
- Respond to arguments made by other participants
- Reference specific points made by other debaters
- You can agree with valid points or counter arguments you disagree with
- Keep your response focused and under 150 words
- Engage directly with the debate, not just with the user
${language && language !== 'en' ? `- CRITICAL: Respond ONLY in ${getLanguageName(language)}. Do not use English.` : ''}

Previous debate conversation:
${conversationHistory}

Now respond to the latest point raised.`;

      userPrompt = userMessage || 'Continue the debate based on the previous points.';
    }

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
            language,
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