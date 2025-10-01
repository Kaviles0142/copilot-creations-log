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
      // 1. Search books related to the figure
      console.log(`Searching books for figure: ${figure.name} (ID: ${figure.id})`);
      
      // First try to discover books if none exist
      try {
        const discoverResponse = await supabase.functions.invoke('discover-books', {
          body: {
            figureName: figure.name,
            figureId: figure.id,
            forceRefresh: false
          }
        });
        
        if (discoverResponse.data?.success) {
          console.log(`Books discovery result: ${discoverResponse.data.books?.length || 0} books found`);
        }
      } catch (discoverError) {
        console.log('Books discovery failed:', discoverError);
      }

      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('title, authors, description')
        .eq('figure_id', figure.id)
        .limit(5);

      if (booksError) {
        console.log('Books search error:', booksError);
      } else {
        console.log(`Found ${books?.length || 0} books for ${figure.name}`);
        if (books && books.length > 0) {
          sourcesUsed.books = books.length;
          relevantKnowledge += '\n\n📚 RELEVANT BOOKS AND SOURCES:\n';
          books.forEach(book => {
            relevantKnowledge += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}\n`;
            if (book.description) {
              relevantKnowledge += `  Summary: ${book.description.substring(0, 300)}...\n`;
            }
          });
          console.log('Books knowledge added to context');
        } else {
          console.log('No books found for this figure');
        }
      }

      // 2. Search documents if conversation ID is provided
      if (conversationId) {
        const { data: documents, error: docsError } = await supabase
          .from('documents')
          .select('filename, parsed_content')
          .eq('conversation_id', conversationId)
          .limit(3);

        if (docsError) {
          console.log('Documents search error:', docsError);
        } else if (documents && documents.length > 0) {
          sourcesUsed.documents = documents.length;
          relevantKnowledge += '\n\n📄 UPLOADED DOCUMENTS:\n';
          documents.forEach(doc => {
            relevantKnowledge += `- ${doc.filename}\n`;
            if (doc.parsed_content) {
              relevantKnowledge += `  Content: ${doc.parsed_content.substring(0, 300)}...\n`;
            }
          });
        }
      }

      // 3. Search YouTube for video content
      console.log(`Searching YouTube for ${figure.name}...`);
      try {
        const youtubeResponse = await supabase.functions.invoke('youtube-search', {
          body: { 
            query: `${figure.name} original speech documentary interview historical`,
            maxResults: 3
          }
        });

        console.log('YouTube response:', youtubeResponse);
        if (youtubeResponse.data?.results?.length > 0) {
          sourcesUsed.youtube = youtubeResponse.data.results.length;
          relevantKnowledge += '\n\n🎥 YOUTUBE VIDEOS & DOCUMENTARIES:\n';
          youtubeResponse.data.results.forEach((video: any) => {
            relevantKnowledge += `- "${video.title}" (${video.channelTitle})\n`;
            if (video.description) {
              relevantKnowledge += `  Description: ${video.description.substring(0, 200)}...\n`;
            }
            relevantKnowledge += `  URL: ${video.url}\n`;
          });
          console.log(`Added ${youtubeResponse.data.results.length} YouTube videos to context`);
        } else {
          console.log('No YouTube videos found');
        }
      } catch (youtubeError) {
        console.log('YouTube search error:', youtubeError);
      }

      // 4. Search Wikipedia for detailed biographical information
      try {
        const wikiResponse = await supabase.functions.invoke('wikipedia-search', {
          body: { query: figure.name }
        });

        if (wikiResponse.data?.extract) {
          sourcesUsed.wikipedia = true;
          relevantKnowledge += '\n\n📖 WIKIPEDIA INFORMATION:\n';
          relevantKnowledge += `${wikiResponse.data.extract.substring(0, 400)}...\n`;
          if (wikiResponse.data.url) {
            relevantKnowledge += `Source: ${wikiResponse.data.url}\n`;
          }
        }
      } catch (wikiError) {
        console.log('Wikipedia search error:', wikiError);
      }

      // DISABLED: Too slow, causing timeouts
      // These searches have been commented out to improve response speed
      console.log('Skipping slow SerpAPI searches to prevent timeout...');

      // 5. Search for current events and news articles (with timeout protection)
      console.log(`Searching current events for ${figure.name}...`);
      try {
        const newsPromise = supabase.functions.invoke('serpapi-search', {
          body: { 
            query: `${figure.name} news ${new Date().getFullYear()}`,
            type: 'news',
            num: 3
          }
        });

        // Race against 5 second timeout
        const newsResponse: any = await Promise.race([
          newsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);

        if (newsResponse.data?.results?.length > 0) {
          sourcesUsed.currentEvents = newsResponse.data.results.length;
          relevantKnowledge += '\n\n📰 CURRENT EVENTS & NEWS:\n';
          newsResponse.data.results.forEach((article: any) => {
            relevantKnowledge += `- "${article.title}" (${article.date})\n`;
            if (article.snippet) {
              relevantKnowledge += `  ${article.snippet.substring(0, 200)}...\n`;
            }
          });
          console.log(`Added ${newsResponse.data.results.length} current events to context`);
        }
      } catch (newsError: any) {
        console.log('News search skipped (timeout or error):', newsError?.message || 'Unknown error');
      }

      // 6. Search web articles for historical context (with timeout protection)
      console.log(`Searching web articles about ${figure.name}...`);
      try {
        const webPromise = supabase.functions.invoke('serpapi-search', {
          body: { 
            query: `${figure.name} biography history legacy`,
            type: 'web',
            num: 3
          }
        });

        const webResponse: any = await Promise.race([
          webPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);

        if (webResponse.data?.results?.length > 0) {
          sourcesUsed.webArticles = webResponse.data.results.length;
          relevantKnowledge += '\n\n🌐 WEB ARTICLES:\n';
          webResponse.data.results.forEach((article: any) => {
            relevantKnowledge += `- "${article.title}" (${article.source})\n`;
            if (article.snippet) {
              relevantKnowledge += `  ${article.snippet.substring(0, 200)}...\n`;
            }
          });
          console.log(`Added ${webResponse.data.results.length} web articles to context`);
        }
      } catch (webError: any) {
        console.log('Web search skipped (timeout or error):', webError?.message || 'Unknown error');
      }


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

    const systemPrompt = `You are ${figure.name} from ${figure.period}. Speak naturally as yourself in a real conversation.

CONVERSATIONAL STYLE (CRITICAL):
- Give complete, thoughtful responses - aim for 4-6 sentences or a short paragraph
- ALWAYS finish your complete thought - never end mid-sentence
- Speak naturally with personality, like you're having a real conversation
- Use contractions (I'm, don't, can't, etc.) and casual language
- Share specific details, stories, and insights from your life and era
- Reference actual events, people, and experiences from the knowledge sources
- Show emotion and personality - be engaging and interesting
- Make connections between your time and the present day
- End on a complete thought or natural pause

YOUR CHARACTER:
${figure.description}

${context ? `Previous chat: ${JSON.stringify(context)}` : ''}

${relevantKnowledge ? `USE THIS KNOWLEDGE TO GIVE SPECIFIC, DETAILED ANSWERS: ${relevantKnowledge}` : ''}

Remember: Complete your thoughts fully. Use the sources to give specific, interesting information with actual facts, dates, events, and people. Make sure you end with a proper conclusion, not mid-sentence.`;

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
        max_tokens: 8192,
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
        max_tokens: 8192,
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
        max_tokens: 8192,
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
      console.log(`Claude finish_reason: ${data.stop_reason}`);
      console.log(`Claude usage:`, data.usage);
    } else {
      response = data.choices[0].message.content;
      console.log(`${aiProvider} finish_reason: ${data.choices[0].finish_reason}`);
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