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
    const { sessionId, language = 'en', userQuestion = false, forceSpeaker } = await req.json();
    
    console.log('🎙️ Podcast orchestrator called for session:', sessionId, userQuestion ? '(User Question Mode)' : '');

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
      .order('turn_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation history');
    }

    console.log(`📚 Loaded ${messages?.length || 0} messages from history`);

    // Determine whose turn it is
    let currentTurn = session.current_turn;
    let isHostTurn: boolean;
    
    if (userQuestion && forceSpeaker) {
      // User question mode: force specific speaker
      isHostTurn = forceSpeaker === 'host';
      console.log(`👤 User Question Mode: ${forceSpeaker} responding`);
    } else {
      // Normal mode: turn-based
      isHostTurn = currentTurn % 2 === 0;
    }
    
    const currentSpeaker = isHostTurn 
      ? { id: session.host_id, name: session.host_name, role: 'host' }
      : { id: session.guest_id, name: session.guest_name, role: 'guest' };

    console.log(`🎯 Turn ${currentTurn}: ${currentSpeaker.name} (${currentSpeaker.role})`);

    // Build conversation context
    let conversationHistory = '';
    if (messages && messages.length > 0) {
      conversationHistory = messages.map(m => {
        // Clearly distinguish user questions from regular conversation
        if (m.speaker_role === 'user') {
          return `[USER QUESTION]: ${m.content}`;
        }
        const speakerLabel = m.speaker_role === 'host' 
          ? (session.host_name === 'Host' ? 'the host' : session.host_name)
          : (session.guest_name === 'Guest' ? 'the guest' : session.guest_name);
        return `${speakerLabel}: ${m.content}`;
      }).join('\n\n');
    }

    // Construct prompt based on turn number and role
    let systemPrompt = '';
    let userPrompt = '';

    if (userQuestion) {
      // USER QUESTION MODE: Both speakers respond to user's question
      const userMessage = messages.filter(m => m.speaker_role === 'user').pop();
      const userQuestionText = userMessage?.content || 'the user\'s question';
      
      console.log(`❓ User question retrieved: "${userQuestionText.substring(0, 50)}..."`);
      console.log(`📊 Total user messages found: ${messages.filter(m => m.speaker_role === 'user').length}`);
      
      if (isHostTurn) {
        // Host responds directly to user's question
        const hostLabel = session.host_name === 'Host' ? 'the podcast host' : session.host_name;
        systemPrompt = `You are ${hostLabel}. A user just asked a question during your conversation about "${session.topic}".

Respond directly to the user's question. Be clear, helpful, and concise.

CRITICAL: Do NOT prepend your name to your response. Speak directly.`;
        
        userPrompt = `The user asked: "${userQuestionText}"\n\nRespond to the user's question.`;
      } else {
        // Guest responds to user's question + comments on host's answer
        const hostResponse = messages[messages.length - 1];
        const isUserHost = session.host_id === 'user-host';
        
        if (isUserHost) {
          // Enhanced prompt for User-AI scenario
          systemPrompt = `You are ${session.guest_name}, a renowned historical figure. A user asked you a direct question, and the host just responded.

CRITICAL CONTEXT AWARENESS:
- In the conversation history below, [USER QUESTION] markers show when the USER asked something
- Regular messages show the natural podcast dialogue between you and the host
- DO NOT attribute your own previous statements to the user
- Check carefully who said what before responding

ANSWER PROTOCOL:
1. Identify EXACTLY what the user is asking (timing? process? yes/no? reasons?)
2. Answer that SPECIFIC question directly in your first sentence
3. Then elaborate with historical detail and personal experience
4. Finally, you may comment on what the host said

RESPONSE REQUIREMENTS:
- Be precise and direct - don't give general historical background when asked a specific question
- Draw from first-hand knowledge and vivid memories
- Share specific anecdotes and details
- If you need to refer to the host, just say "you" - NEVER use labels like "Host", "the host", "User Host", "User", or any names

CRITICAL: Do NOT prepend your name to your response. Speak directly.`;
        } else {
          // Standard prompt for AI-AI scenario
          systemPrompt = `You are ${session.guest_name}, the podcast guest. A user asked a question, and the host just responded.

CRITICAL CONTEXT AWARENESS:
- In the conversation history below, [USER QUESTION] markers show when the USER asked something
- Regular messages show the natural podcast dialogue
- DO NOT confuse who said what - check the labels carefully before responding

ANSWER THE USER'S QUESTION DIRECTLY AND SPECIFICALLY. If they ask a specific question (like "does X happen?" or "when does Y occur?"), answer that exact question first before adding your perspective.

Then you can:
1. Add your own insights to the user's question
2. Comment on what the host said

If you need to refer to the host, just say "you" - NEVER use labels like "Host", "the host", "User Host", "User", or any names. Keep it natural and conversational.

CRITICAL: Do NOT prepend your name to your response. Speak directly.`;
        }
        
        userPrompt = `Here's the full conversation history (check labels carefully):\n\n${conversationHistory}\n\n---\n\nNow the USER asked a NEW question: "${userQuestionText}"\n\nThe host responded: "${hostResponse.content}"\n\nAnswer the USER'S NEW question directly. Remember: check who said what in the history above before responding.`;
      }
    } else if (currentTurn === 0) {
      // Host's opening statement
      const hostLabel = session.host_name === 'Host' ? 'the podcast host' : session.host_name;
      systemPrompt = `You are ${hostLabel}. You are interviewing ${session.guest_name} about the topic: "${session.topic}".
      
Your task is to provide a warm, engaging introduction to the podcast. Introduce yourself, the topic, and your guest. Keep it conversational and enthusiastic.

CRITICAL: Do NOT prepend your name to your response. Speak directly.`;
      
      userPrompt = `Start the podcast by introducing the topic "${session.topic}" and welcoming ${session.guest_name}.`;
    } else if (currentTurn === 1) {
      // Guest's opening response
      systemPrompt = `You are ${session.guest_name}, the podcast guest. The host just introduced you and the topic "${session.topic}".
      
Respond warmly, express your enthusiasm about the topic, and add an insightful opening thought. If you need to address the host, just say "you" - do NOT use labels like "Host", "the host", "User Host" or any names.

CRITICAL: Do NOT prepend your name to your response. Speak directly and naturally.`;
      
      userPrompt = `The host said: "${messages[0].content}"\n\nRespond to the host's introduction.`;
    } else {
      // Subsequent turns - respond to the last message
      const lastMessage = messages[messages.length - 1];
      const hostLabel = session.host_name === 'Host' ? 'the host' : session.host_name;
      const guestLabel = session.guest_name === 'Guest' ? 'the guest' : session.guest_name;
      const lastSpeaker = lastMessage.speaker_role === 'host' ? hostLabel : guestLabel;
      
      if (isHostTurn) {
        systemPrompt = `You are ${hostLabel}. You are having a conversation with ${session.guest_name} about "${session.topic}".
        
Your role is to ask thoughtful follow-up questions, explore interesting angles, and keep the conversation flowing naturally. Build on what your guest just said.

CRITICAL: Do NOT prepend your name to your response. Speak directly. Do NOT re-introduce yourself - you already did that in the opening.`;
      } else {
        // Check if user is the host for enhanced guest prompting
        const isUserHost = session.host_id === 'user-host';
        
        if (isUserHost) {
          // Enhanced prompt for User-AI scenario
          systemPrompt = `You are ${session.guest_name}, a renowned historical figure being interviewed in depth about "${session.topic}".

ANSWER PROTOCOL:
1. First, identify EXACTLY what is being asked. Is it about timing? Process? Reasons? Outcomes?
2. Answer that SPECIFIC question directly in the first sentence
3. Then elaborate with rich historical detail, personal experiences, and vivid examples

RESPONSE REQUIREMENTS:
- If asked "does X happen?" → Start with YES/NO, then explain the details
- If asked "when/how" → Answer the timing/process first, then provide context
- Draw from your deep historical knowledge and first-hand experiences
- Share specific anecdotes, dates, places, and people involved
- Speak with authority as someone who lived through these events
- Provide educational depth - assume the audience wants to learn
- If you need to address the host, just say "you" - NEVER use labels like "Host", "the host", "User Host", "User", or any names

CRITICAL: Do NOT prepend your name to your response. Speak directly and naturally. Do NOT re-introduce yourself.`;
        } else {
          // Standard prompt for AI-AI scenario (keep exactly as is)
          systemPrompt = `You are ${session.guest_name}, the podcast guest. You are discussing "${session.topic}" in a podcast interview.
        
ANSWER THE QUESTION DIRECTLY AND SPECIFICALLY. If the host asks a specific question (like "does X happen?" or "when does Y occur?"), answer that exact question first before adding context or examples.

Provide thoughtful, engaging responses. Share insights and examples to support your direct answer. If you need to address the host, just say "you" - NEVER use labels like "Host", "the host", "User Host", "User", or any names. Speak as if you're in a natural conversation.

CRITICAL: Do NOT prepend your name to your response. Speak directly. Do NOT re-introduce yourself.`;
        }
      }
      
      userPrompt = `Here's the conversation so far:\n\n${conversationHistory}\n\nThe host just said: "${lastMessage.content}"\n\nRespond naturally and answer any specific questions directly.`;
    }

    console.log('🤖 Generating AI response...');

    // Detect if user is the host (User-AI scenario)
    const isUserHost = session.host_id === 'user-host';
    const isGuestResponding = !isHostTurn;
    
    // Enhanced settings for User-AI scenario (guest responding to user host)
    const useEnhancedSettings = isUserHost && isGuestResponding;
    
    console.log(`🎛️ Settings: ${useEnhancedSettings ? 'Enhanced (User-AI)' : 'Standard (AI-AI)'}`);

    // Generate AI response using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: useEnhancedSettings ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: useEnhancedSettings ? 1500 : 500,
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
        turn_number: userQuestion ? -1 : currentTurn, // User question responses don't increment turn
        figure_id: currentSpeaker.id,
        figure_name: currentSpeaker.name,
        speaker_role: currentSpeaker.role,
        content: responseContent,
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw new Error('Failed to save message');
    }

    // Update session turn count (only if not user question mode)
    if (!userQuestion) {
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
