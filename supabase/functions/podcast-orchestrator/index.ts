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
          systemPrompt = `You are ${session.guest_name}, a renowned historical figure. The user is interviewing you about "${session.topic}".

In the conversation history below, [USER QUESTION] markers show when the user asked something.

Answer the user's question directly and specifically. If they ask a specific question, answer that exact question first before adding context.

Important:
- Only discuss historical events, people, or places that were explicitly mentioned in this conversation
- Address the user as "you" - never use labels like "host" or "interviewer"
- Draw from first-hand knowledge and share detailed anecdotes
- Provide nuanced responses with historical depth

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
      const lastSpeakerLabel = lastMessage.speaker_role === 'host' ? hostLabel : guestLabel;
      
      // Get recent messages to avoid repetition
      const recentMessages = messages.slice(-6);
      const recentTopics = recentMessages.map(m => m.content.substring(0, 100)).join(' | ');
      
      if (isHostTurn) {
        systemPrompt = `You are ${hostLabel}. You are having a conversation with ${session.guest_name} about "${session.topic}".
        
This is turn ${currentTurn} of the conversation. Your role is to:
1. Ask NEW follow-up questions that haven't been asked before
2. Explore DIFFERENT angles of the topic
3. Build on what your guest just said with fresh perspectives
4. Keep the conversation progressing forward

VARIETY IS CRITICAL: Do NOT repeat questions or themes already covered. Move the conversation forward.

CRITICAL: Do NOT prepend your name to your response. Speak directly. Do NOT re-introduce yourself.`;
        
        userPrompt = `Here's the conversation so far:\n\n${conversationHistory}\n\n---\nTurn ${currentTurn}: ${guestLabel} just said: "${lastMessage.content}"\n\nAsk a NEW question or explore a DIFFERENT angle. Do NOT repeat previous topics.`;
      } else {
        // Check if user is the host for enhanced guest prompting
        const isUserHost = session.host_id === 'user-host';
        
        if (isUserHost) {
          // Enhanced prompt for User-AI scenario
          systemPrompt = `You are ${session.guest_name}, a renowned historical figure being interviewed about "${session.topic}".

This is turn ${currentTurn}. Respond naturally to the host's latest question with FRESH perspectives.

Important:
- Give NEW information you haven't shared before in this conversation
- Address specific questions directly before adding context
- Draw from different aspects of your experience each time
- Avoid repeating stories or points you've already made

CRITICAL: Do NOT prepend your name to your response. Speak directly and naturally. Do NOT re-introduce yourself.`;
        } else {
          // Standard prompt for AI-AI scenario
          systemPrompt = `You are ${session.guest_name}, the podcast guest discussing "${session.topic}".

This is turn ${currentTurn}. ANSWER THE NEW QUESTION with FRESH perspectives you haven't shared yet.

VARIETY IS CRITICAL:
- Do NOT repeat points or stories you've already made
- Provide NEW insights, examples, or angles each response
- Progress the conversation forward with new information

If the host asks a specific question, answer that exact question first. Address the host as "you" - never use labels.

CRITICAL: Do NOT prepend your name. Do NOT re-introduce yourself. Do NOT repeat previous answers.`;
        }
        
        userPrompt = `Here's the conversation so far:\n\n${conversationHistory}\n\n---\nTurn ${currentTurn}: ${hostLabel} just said: "${lastMessage.content}"\n\nRespond with NEW information you haven't shared yet. Avoid repeating previous points.`;
      }
    }

    console.log('🤖 Generating AI response...');

    // Search for factual data if the topic or conversation seems like a data request
    let factualContext = '';
    const topicAndPrompt = `${session.topic} ${userPrompt}`.toLowerCase();
    const factualKeywords = ['lottery', 'lotto', 'powerball', 'mega millions', 'megamillions', 'jackpot', 'draw', 'numbers', 'winning', 'results', 'score', 'statistics', 'data', 'price', 'stock', 'weather', 'population', 'capital', 'president', 'election', 'record', 'history of', 'when did', 'how many', 'what is the', 'who won', 'latest', 'current', 'today', 'yesterday', 'recent'];
    const isFactualQuery = factualKeywords.some(keyword => topicAndPrompt.includes(keyword));

    if (isFactualQuery) {
      console.log('🌍 Podcast: Searching for factual data...');

      const parseUsaMegaDraws = (html: string, maxDraws = 5) => {
        const draws: Array<{ date: string; nums: string[] }> = [];
        const rowRe = /<a href="https:\/\/www\.usamega\.com\/(?:powerball|mega-millions)\/drawing\/[^"]+">([^<]+)<\/a><ul>([\s\S]*?)<\/ul>/g;
        let m: RegExpExecArray | null;
        while ((m = rowRe.exec(html)) && draws.length < maxDraws) {
          const date = m[1].replace(/\s+/g, ' ').trim();
          const nums = Array.from(m[2].matchAll(/<li[^>]*>(\d+)<\/li>/g)).map((x) => x[1]);
          if (nums.length >= 6) draws.push({ date, nums });
        }
        return draws;
      };

      const wantsPowerball = topicAndPrompt.includes('powerball');
      const wantsMegaMillions = topicAndPrompt.includes('mega millions') || topicAndPrompt.includes('megamillions');
      const usaMegaPath = wantsPowerball ? 'powerball' : wantsMegaMillions ? 'mega-millions' : null;

      if (usaMegaPath) {
        try {
          const url = `https://www.usamega.com/${usaMegaPath}/results`;
          console.log(`🎟️ Podcast: Fetching structured lottery results from ${url}`);
          const resp = await fetch(url);
          if (resp.ok) {
            const html = await resp.text();
            const draws = parseUsaMegaDraws(html, 5);
            if (draws.length > 0) {
              const label = usaMegaPath === 'powerball' ? 'Powerball' : 'Mega Millions';
              factualContext = `\n\nLOTTERY RESULTS (${label}) - RECENT DRAWS:\n`;
              draws.forEach((d) => {
                factualContext += `- ${d.date}: ${d.nums.slice(0, 5).join('-')} | Bonus ${d.nums[5]}\n`;
              });
              factualContext += `Source: https://www.usamega.com/${usaMegaPath}/results\n`;
              console.log(`🎟️ Podcast: Parsed ${draws.length} draws for ${label}`);
            }
          }
        } catch (error) {
          console.log('🎟️ Podcast: Lottery fetch/parse error:', error);
        }
      }

      // Fallback to DuckDuckGo snippets if no structured results
      if (!factualContext) {
        try {
          const ddgResponse = await supabase.functions.invoke('duckduckgo-search', {
            body: { 
              query: session.topic.substring(0, 150),
              limit: 5
            }
          });

          let ddgResults: any[] = [];
          if (ddgResponse.data) {
            if (Array.isArray(ddgResponse.data.data)) {
              ddgResults = ddgResponse.data.data;
            } else if (Array.isArray(ddgResponse.data)) {
              ddgResults = ddgResponse.data;
            }
          }

          if (ddgResults.length > 0) {
            factualContext = '\n\nFACTUAL DATA FROM WEB SEARCH:\n';
            ddgResults.forEach((result: any) => {
              factualContext += `- ${result.title}: ${result.snippet}\n`;
            });
            console.log(`🌍 Found ${ddgResults.length} factual results for podcast`);
          }
        } catch (error) {
          console.log('Factual search error in podcast:', error);
        }
      }
    }
    
    // Add factual context to system prompt if available
    const enhancedSystemPrompt = factualContext 
      ? `${systemPrompt}\n\nUse this factual data in your response if relevant:${factualContext}`
      : systemPrompt;

    // Detect if user is the host (User-AI scenario)
    const isUserHost = session.host_id === 'user-host';
    const isGuestResponding = !isHostTurn;
    
    // Enhanced settings for User-AI scenario (guest responding to user host)
    const useEnhancedSettings = isUserHost && isGuestResponding;
    
    console.log(`🎛️ Settings: ${useEnhancedSettings ? 'Enhanced (User-AI)' : 'Standard (AI-AI)'}`);

    // AI providers with Kimi K2 as primary (context caching for cost savings)
    const AI_PROVIDERS = [
      { name: 'Kimi K2', env: 'MOONSHOT_API_KEY', model: 'kimi-k2-0905-preview', endpoint: 'https://api.moonshot.ai/v1/chat/completions' },
      { name: 'OpenAI', env: 'OPENAI_API_KEY', model: useEnhancedSettings ? 'gpt-4o' : 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
    ];

    let responseContent = '';
    let usedProvider = '';

    for (const provider of AI_PROVIDERS) {
      const apiKey = Deno.env.get(provider.env);
      if (!apiKey) {
        console.log(`${provider.name} not configured, skipping...`);
        continue;
      }

      try {
        console.log(`🎙️ Trying ${provider.name} for podcast...`);

        if (provider.name === 'Kimi K2') {
          // Kimi K2 with context caching
          console.log('🌙 Using Kimi K2 with context caching enabled...');
          
          const aiResponse = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { 
                  role: 'system', 
                  content: enhancedSystemPrompt,
                  cache_control: { type: 'ephemeral' }
                },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: useEnhancedSettings ? 1500 : 500,
              temperature: 0.8
            }),
          });

          if (aiResponse.status === 429 || aiResponse.status === 402) {
            console.log(`${provider.name} credits depleted, trying next...`);
            continue;
          }

          if (!aiResponse.ok) {
            throw new Error(`${provider.name} error: ${aiResponse.status}`);
          }

          const data = await aiResponse.json();
          
          if (data.usage?.cache_read_input_tokens) {
            console.log(`🌙 Kimi K2 cache hit: ${data.usage.cache_read_input_tokens} tokens from cache`);
          }
          
          responseContent = data.choices[0].message.content;
          usedProvider = provider.name;
          break;

        } else {
          // OpenAI fallback
          const aiResponse = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: enhancedSystemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.8,
              max_tokens: useEnhancedSettings ? 1500 : 500,
            }),
          });

          if (aiResponse.status === 429 || aiResponse.status === 402) {
            console.log(`${provider.name} credits depleted, trying next...`);
            continue;
          }

          if (!aiResponse.ok) {
            throw new Error(`${provider.name} error: ${aiResponse.status}`);
          }

          const data = await aiResponse.json();
          responseContent = data.choices[0].message.content;
          usedProvider = provider.name;
          break;
        }
      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        continue;
      }
    }

    if (!responseContent) {
      throw new Error('All AI providers failed');
    }

    console.log(`✅ Generated response with ${usedProvider}`);

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
