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
    const { sessionId, currentTurn, language } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('podcast_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get all previous messages for context
    const { data: previousMessages } = await supabase
      .from('podcast_messages')
      .select('*')
      .eq('podcast_session_id', sessionId)
      .order('turn_number', { ascending: true });

    const conversationContext = previousMessages
      ?.map(msg => `${msg.figure_name}: ${msg.content}`)
      .join('\n') || '';

    // Determine current speaker
    const isHostTurn = currentTurn % 2 === 0;
    const currentFigureId = isHostTurn ? session.host_id : session.guest_id;
    const currentFigureName = isHostTurn ? session.host_name : session.guest_name;
    const otherFigureName = isHostTurn ? session.guest_name : session.host_name;
    const speakerRole = isHostTurn ? 'host' : 'guest';

    // Build prompt based on turn number
    let prompt;
    if (currentTurn === 0) {
      // Host introduces the podcast
      prompt = `Welcome your guest ${otherFigureName} and introduce today's podcast topic: "${session.topic}". Keep it warm and engaging.`;
    } else if (currentTurn === 1) {
      // Guest responds to introduction
      prompt = `Respond warmly to ${otherFigureName}'s introduction and share your initial thoughts on "${session.topic}".`;
    } else {
      // Continue natural conversation
      prompt = `Continue the podcast discussion about "${session.topic}" with ${otherFigureName}. Recent context:\n${conversationContext.split('\n').slice(-2).join('\n')}`;
    }

    console.log(`Turn ${currentTurn}: ${currentFigureName} (${speakerRole}) speaking`);

    // Get AI response
    const { data: aiData, error: aiError } = await supabase.functions.invoke('chat-with-historical-figure', {
      body: {
        message: prompt,
        figure: {
          id: currentFigureId,
          name: currentFigureName,
          period: '',
          description: ''
        },
        language: language || 'en',
        conversationType: 'casual'
      }
    });

    if (aiError) throw aiError;

    const response = aiData.response;

    // Save message to database
    const { error: messageError } = await supabase
      .from('podcast_messages')
      .insert({
        podcast_session_id: sessionId,
        turn_number: currentTurn,
        speaker_role: speakerRole,
        content: response,
        figure_id: currentFigureId,
        figure_name: currentFigureName
      });

    if (messageError) throw messageError;

    // Update session turn
    const { error: updateError } = await supabase
      .from('podcast_sessions')
      .update({
        current_turn: currentTurn + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Determine if we should continue (limit to 10 exchanges = 20 total messages)
    const shouldContinue = currentTurn < 19;

    return new Response(
      JSON.stringify({
        response,
        shouldContinue,
        nextTurn: currentTurn + 1,
        speakerRole,
        figureName: currentFigureName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in podcast-orchestrator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
