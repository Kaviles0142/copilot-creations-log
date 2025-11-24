import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { sessionId, language = 'en' } = await req.json();
    
    console.log('🎙️ Podcast orchestrator called for session:', sessionId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('podcast_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      throw new Error('Session not found');
    }

    // Fetch all messages in chronological order
    const { data: messages, error: messagesError } = await supabase
      .from('podcast_messages')
      .select('*')
      .eq('podcast_session_id', sessionId)
      .order('turn_number', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation history');
    }

    console.log(`📚 Loaded ${messages?.length || 0} messages from history`);

    // Determine whose turn it is
    const currentTurn = session.current_turn;
    const isHostTurn = currentTurn % 2 === 0;
    
    const currentSpeaker = isHostTurn 
      ? { id: session.host_id, name: session.host_name, role: 'host' }
      : { id: session.guest_id, name: session.guest_name, role: 'guest' };

    console.log(`🎯 Turn ${currentTurn}: ${currentSpeaker.name} (${currentSpeaker.role})`);

    // Build conversation context
    let conversationHistory = '';
    if (messages && messages.length > 0) {
      conversationHistory = messages.map(m => 
        `${m.speaker_role === 'host' ? session.host_name : session.guest_name}: ${m.content}`
      ).join('\n\n');
    }

    // Construct prompt based on turn number and role
    let systemPrompt = '';
    let userPrompt = '';

    if (currentTurn === 0) {
      // Host's opening statement
      systemPrompt = `You are ${session.host_name}, the podcast host. You are interviewing ${session.guest_name} about the topic: "${session.topic}".
      
Your task is to provide a warm, engaging introduction to the podcast. Introduce yourself, the topic, and your guest. Keep it conversational and enthusiastic.

CRITICAL: Do NOT prepend your name to your response. Do NOT write "${session.host_name}:" at the start. Speak directly.`;
      
      userPrompt = `Start the podcast by introducing the topic "${session.topic}" and welcoming ${session.guest_name}.`;
    } else if (currentTurn === 1) {
      // Guest's opening response
      systemPrompt = `You are ${session.guest_name}, the podcast guest. The host ${session.host_name} just introduced you and the topic "${session.topic}".
      
Respond warmly, express your enthusiasm about the topic, and add an insightful opening thought.

CRITICAL: Do NOT prepend your name to your response. Do NOT write "${session.guest_name}:" at the start. Speak directly.`;
      
      userPrompt = `The host said: "${messages[0].content}"\n\nRespond to the host's introduction.`;
    } else {
      // Subsequent turns - respond to the last message
      const lastMessage = messages[messages.length - 1];
      const lastSpeaker = lastMessage.speaker_role === 'host' ? session.host_name : session.guest_name;
      const otherSpeaker = lastMessage.speaker_role === 'host' ? session.guest_name : session.host_name;
      
      if (isHostTurn) {
        systemPrompt = `You are ${session.host_name}, the podcast host. You are having a conversation with ${session.guest_name} about "${session.topic}".
        
Your role is to ask thoughtful follow-up questions, explore interesting angles, and keep the conversation flowing naturally. Build on what your guest just said.

CRITICAL: Do NOT prepend your name to your response. Do NOT write "${session.host_name}:" at the start. Speak directly. Do NOT re-introduce yourself - you already did that in the opening.`;
      } else {
        systemPrompt = `You are ${session.guest_name}, the podcast guest. You are discussing "${session.topic}" with the host ${session.host_name}.
        
Provide thoughtful, engaging responses to the host's questions. Share insights, examples, and build on the conversation naturally.

CRITICAL: Do NOT prepend your name to your response. Do NOT write "${session.guest_name}:" at the start. Speak directly. Do NOT re-introduce yourself - you already did that in your opening response.`;
      }
      
      userPrompt = `Here's the conversation so far:\n\n${conversationHistory}\n\n${lastSpeaker} just said: "${lastMessage.content}"\n\nRespond to ${lastSpeaker} as ${currentSpeaker.name}.`;
    }

    console.log('🤖 Generating AI response...');

    // Generate AI response using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to generate AI response');
    }

    const aiData = await openaiResponse.json();
    const responseContent = aiData.choices[0].message.content;

    console.log('💬 Generated response:', responseContent.substring(0, 100) + '...');

    // Save the message
    const { error: insertError } = await supabase
      .from('podcast_messages')
      .insert({
        podcast_session_id: sessionId,
        turn_number: currentTurn,
        figure_id: currentSpeaker.id,
        figure_name: currentSpeaker.name,
        speaker_role: currentSpeaker.role,
        content: responseContent,
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw new Error('Failed to save message');
    }

    // Update session turn count
    const { error: updateError } = await supabase
      .from('podcast_sessions')
      .update({ 
        current_turn: currentTurn + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
    }

    console.log('✅ Turn completed successfully');

    // Clean up stage directions like [Music], [Applause], etc.
    const cleanedContent = responseContent
      .replace(/\[.*?\]/g, '')  // Remove anything in square brackets
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with max 2

    return new Response(
      JSON.stringify({ 
        success: true,
        message: cleanedContent,
        speaker: currentSpeaker,
        nextTurn: currentTurn + 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in podcast-orchestrator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
