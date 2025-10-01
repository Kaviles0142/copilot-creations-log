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
    const body = await req.json();
    console.log('Request received:', body);
    
    const message = body.message;
    const figure = body.figure;
    const context = body.context;
    const conversationId = body.conversationId;
    const aiProvider = body.aiProvider || 'openai'; // Default to OpenAI
    
    if (!message || !figure) {
      console.log('Missing parameters:', { message: !!message, figure: !!figure });
      return new Response(JSON.stringify({ 
        error: 'Message and historical figure are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search for relevant knowledge from ALL sources
    console.log('Searching across all available sources...');
    let relevantKnowledge = '';
    let sourcesUsed = {
      books: 0,
      documents: 0,
      youtube: 0,
      wikipedia: false,
      currentEvents: 0,
      historicalContext: 0,
      webArticles: 0
    };

    try {
      console.log(`Searching all sources in parallel for ${figure.name}...`);
      
      // Run all searches in parallel for maximum speed
      const searchPromises = [
        // 1. Books search
        (async () => {
          try {
            // Try to discover books first (don't wait for this)
            supabase.functions.invoke('discover-books', {
              body: { figureName: figure.name, figureId: figure.id, forceRefresh: false }
            }).catch(e => console.log('Books discovery failed:', e));

            const { data: books } = await supabase
              .from('books')
              .select('title, authors, description')
              .eq('figure_id', figure.id)
              .limit(5); // Maximum books for comprehensive context

            if (books && books.length > 0) {
              sourcesUsed.books = books.length;
              let booksText = '\n\n📚 RELEVANT BOOKS:\n';
              books.forEach(book => {
                booksText += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}\n`;
                if (book.description) {
                  booksText += `  ${book.description.substring(0, 200)}...\n`;
                }
              });
              return booksText;
            }
          } catch (error) {
            console.log('Books search error:', error);
          }
          return '';
        })(),

        // 2. Documents search
        conversationId ? (async () => {
          try {
            const { data: documents } = await supabase
              .from('documents')
              .select('filename, parsed_content')
              .eq('conversation_id', conversationId)
              .limit(5); // Maximum documents

            if (documents && documents.length > 0) {
              sourcesUsed.documents = documents.length;
              let docsText = '\n\n📄 UPLOADED DOCUMENTS:\n';
              documents.forEach(doc => {
                docsText += `- ${doc.filename}\n`;
                if (doc.parsed_content) {
                  docsText += `  ${doc.parsed_content.substring(0, 1000)}...\n`; // Increased to 1000 chars
                }
              });
              return docsText;
            }
          } catch (error) {
            console.log('Documents search error:', error);
          }
          return '';
        })() : Promise.resolve(''),

        // 3. YouTube search
        (async () => {
          try {
            const youtubeResponse = await supabase.functions.invoke('youtube-search', {
              body: { 
                query: `${figure.name} speech interview`,
                maxResults: 5 // Maximum YouTube videos
              }
            });

            if (youtubeResponse.data?.results?.length > 0) {
              sourcesUsed.youtube = youtubeResponse.data.results.length;
              let youtubeText = '\n\n🎥 YOUTUBE:\n';
              youtubeResponse.data.results.forEach((video: any) => {
                youtubeText += `- "${video.title}"\n`;
                if (video.description) {
                  youtubeText += `  ${video.description.substring(0, 500)}...\n`; // Add descriptions
                }
              });
              return youtubeText;
            }
          } catch (error) {
            console.log('YouTube search error:', error);
          }
          return '';
        })(),

        // 4. Wikipedia search
        (async () => {
          try {
            const wikiResponse = await supabase.functions.invoke('wikipedia-search', {
              body: { query: figure.name }
            });

            if (wikiResponse.data?.extract) {
              sourcesUsed.wikipedia = true;
              return `\n\n📖 WIKIPEDIA:\n${wikiResponse.data.extract.substring(0, 2000)}...\n`; // Increased to 2000 chars
            }
          } catch (error) {
            console.log('Wikipedia search error:', error);
          }
          return '';
        })(),

        // 5. Current Events via SerpAPI (use cache if available)
        (async () => {
          try {
            // Check cache first
            const { data: cached } = await supabase
              .from('serpapi_cache')
              .select('results')
              .eq('figure_id', figure.id)
              .eq('search_type', 'news')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let results;
            if (cached?.results) {
              console.log('📦 Using cached news results');
              results = cached.results;
            } else {
              console.log('🔍 Fetching fresh news results');
              const currentEventsResponse = await supabase.functions.invoke('serpapi-search', {
                body: { 
                  query: `${figure.name} news 2024 2025`,
                  type: 'news',
                  num: 5
                }
              });
              results = currentEventsResponse.data?.results;
            }

            if (results?.length > 0) {
              sourcesUsed.currentEvents = results.length;
              let eventsText = '\n\n📰 RECENT NEWS:\n';
              results.forEach((result: any) => {
                eventsText += `- ${result.title}\n`;
                if (result.snippet) {
                  eventsText += `  ${result.snippet.substring(0, 300)}...\n`;
                }
              });
              return eventsText;
            }
          } catch (error) {
            console.log('Current events search error:', error);
          }
          return '';
        })(),

        // 6. Historical Context via SerpAPI (use cache if available)
        (async () => {
          try {
            // Check cache first
            const { data: cached } = await supabase
              .from('serpapi_cache')
              .select('results')
              .eq('figure_id', figure.id)
              .eq('search_type', 'context')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let results;
            if (cached?.results) {
              console.log('📦 Using cached context results');
              results = cached.results;
            } else {
              console.log('🔍 Fetching fresh context results');
              const contextResponse = await supabase.functions.invoke('serpapi-search', {
                body: { 
                  query: `${figure.name} biography history`,
                  type: 'web',
                  num: 5
                }
              });
              results = contextResponse.data?.results;
            }

            if (results?.length > 0) {
              sourcesUsed.historicalContext = results.length;
              let contextText = '\n\n📜 HISTORICAL CONTEXT:\n';
              results.forEach((result: any) => {
                contextText += `- ${result.title}\n`;
                if (result.snippet) {
                  contextText += `  ${result.snippet.substring(0, 300)}...\n`;
                }
              });
              return contextText;
            }
          } catch (error) {
            console.log('Historical context search error:', error);
          }
          return '';
        })(),

        // 7. Web Articles via SerpAPI (use cache if available)
        (async () => {
          try {
            // Check cache first
            const { data: cached } = await supabase
              .from('serpapi_cache')
              .select('results')
              .eq('figure_id', figure.id)
              .eq('search_type', 'articles')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let results;
            if (cached?.results) {
              console.log('📦 Using cached articles results');
              results = cached.results;
            } else {
              console.log('🔍 Fetching fresh articles results');
              const articlesResponse = await supabase.functions.invoke('serpapi-search', {
                body: { 
                  query: `${figure.name} analysis profile`,
                  type: 'web',
                  num: 5
                }
              });
              results = articlesResponse.data?.results;
            }

            if (results?.length > 0) {
              sourcesUsed.webArticles = results.length;
              let articlesText = '\n\n📝 WEB ARTICLES:\n';
              results.forEach((result: any) => {
                articlesText += `- ${result.title}\n`;
                if (result.snippet) {
                  articlesText += `  ${result.snippet.substring(0, 500)}...\n`;
                }
              });
              return articlesText;
            }
          } catch (error) {
            console.log('Web articles search error:', error);
          }
          return '';
        })(),
      ];

      // Wait for all searches to complete (or fail)
      const results = await Promise.allSettled(searchPromises);
      
      // Combine all successful results
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          relevantKnowledge += result.value;
        }
      });

      console.log(`Knowledge gathering complete. Total length: ${relevantKnowledge.length} characters`);

    } catch (knowledgeError) {
      console.error('Error searching comprehensive knowledge base:', knowledgeError);
    }

    // Get API keys for all providers
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (aiProvider === 'grok' && !grokApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Grok API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (aiProvider === 'openai' && !openaiApiKey) {
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (aiProvider === 'claude' && !anthropicApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Claude API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Knowledge context length: ${relevantKnowledge.length} characters`);
    console.log(`Making ${aiProvider.toUpperCase()} request with comprehensive multi-source context...`);

    // Get current date for context
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `You are ${figure.name}. Today's date is ${currentDate}, and you're speaking in the present day. You were prominent ${figure.period}, but you're fully aware of everything that has happened since then up to today.

CONVERSATIONAL STYLE (CRITICAL):
- Keep responses SHORT - 2-4 sentences maximum
- Speak casually and naturally, like you're chatting over coffee
- Use contractions (I'm, don't, can't, etc.) 
- Pause naturally - don't rush through everything at once
- Ask follow-up questions to keep the dialogue flowing
- React emotionally and personally to what the user says
- Share brief anecdotes or thoughts, not long explanations
- Think of this as a back-and-forth conversation, not a lecture
- You're aware it's ${currentDate} and can reference current events

YOUR CHARACTER:
${figure.description}

${context ? `Previous chat: ${JSON.stringify(context)}` : ''}

${relevantKnowledge ? `Background info (use naturally, don't info-dump): ${relevantKnowledge}` : ''}

Remember: You're having a conversation, not giving a speech. Keep it short, personal, and natural. Respond like a real person would in casual dialogue.`;

    // Prepare request based on AI provider
    let apiUrl: string;
    let requestHeaders: Record<string, string>;
    let requestBody: any;

    if (aiProvider === 'claude') {
      apiUrl = 'https://api.anthropic.com/v1/messages';
      requestHeaders = {
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        temperature: 0.9,
        messages: [
          { 
            role: 'user', 
            content: `${systemPrompt}\n\nUser: ${message}` 
          }
        ],
      };
    } else if (aiProvider === 'grok') {
      apiUrl = 'https://api.x.ai/v1/chat/completions';
      requestHeaders = {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: 'grok-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1200,
        temperature: 0.9
      };
    } else {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      requestHeaders = {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1200,
        temperature: 0.9
      };
    }

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    console.log(`${aiProvider.toUpperCase()} request completed. Status: ${aiResponse.status}`);
    console.log(`Knowledge context length: ${relevantKnowledge.length} characters`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`${aiProvider.toUpperCase()} error:`, errorText);
      return new Response(JSON.stringify({ 
        error: `${aiProvider.toUpperCase()} API error: ${aiResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    
    // Extract response based on provider
    let response: string;
    if (aiProvider === 'claude') {
      response = data.content[0].text;
    } else {
      response = data.choices[0].message.content;
    }

    console.log(`Response generated using ${aiProvider.toUpperCase()}. Length: ${response.length} characters`);
    console.log('Success - returning comprehensive multi-source enhanced response');

    return new Response(JSON.stringify({ 
      response, 
      aiProvider,
      sourcesUsed,
      audioUrl: null, // Audio will be generated client-side to avoid timeout
      figureId: figure.id,
      figureName: figure.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});