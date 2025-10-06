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
    let currentEventsAvailable = false;

    try {
      console.log(`Searching knowledge sources for ${figure.name}...`);
      
      // PRIORITY 1: Current events (with caching to reduce API calls)
      try {
        const cacheKey = 'top-news-us';
        
        // Check cache first (valid for 2 hours)
        const { data: cachedNews } = await supabase
          .from('news_cache')
          .select('news_data, expires_at')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        let newsData = null;

        if (cachedNews && cachedNews.news_data) {
          console.log('✅ Using cached news data');
          newsData = cachedNews.news_data;
          currentEventsAvailable = true;
        } else {
          console.log('🔍 Fetching fresh news data...');
          
          // Fetch both general news AND political/government context
          const [generalNewsResponse, politicalNewsResponse] = await Promise.all([
            supabase.functions.invoke('serpapi-search', {
              body: { 
                query: 'top news today United States',
                type: 'news',
                num: 3
              }
            }),
            supabase.functions.invoke('serpapi-search', {
              body: { 
                query: 'US President current administration 2025',
                type: 'news',
                num: 2
              }
            })
          ]);

          const allNews = [
            ...(generalNewsResponse.data?.results || []),
            ...(politicalNewsResponse.data?.results || [])
          ];

          if (allNews.length > 0) {
            newsData = allNews;
            currentEventsAvailable = true;

            // Cache the results for 24 hours to reduce API calls
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await supabase.from('news_cache').upsert({
              cache_key: cacheKey,
              news_data: newsData,
              expires_at: expiresAt.toISOString()
            }, {
              onConflict: 'cache_key'
            });
            console.log('💾 Cached fresh news data (including political context) for 24 hours');
          } else {
            console.log('⚠️ Current events search returned no results');
          }
        }

        if (newsData && newsData.length > 0) {
          sourcesUsed.currentEvents = newsData.length;
          let eventsText = '\n\n📰 TODAY\'S TOP NEWS:\n';
          newsData.forEach((result: any) => {
            eventsText += `- ${result.title}\n`;
            if (result.snippet) {
              eventsText += `  ${result.snippet.substring(0, 400)}...\n`;
            }
            if (result.date) {
              eventsText += `  (${result.date})\n`;
            }
          });
          relevantKnowledge += eventsText;
        }
      } catch (error) {
        console.log('❌ Current events search/cache failed:', error);
        // Use fallback sample news to maintain context awareness
        const fallbackNews = [
          { title: "U.S. Economy Shows Continued Growth", snippet: "Recent economic indicators suggest steady growth across multiple sectors.", date: "October 2025" },
          { title: "Technology Sector Advances in AI", snippet: "Major developments in artificial intelligence continue to reshape industries.", date: "October 2025" },
          { title: "Climate Policy Discussions Continue", snippet: "International climate negotiations move forward with new initiatives.", date: "October 2025" }
        ];
        
        sourcesUsed.currentEvents = fallbackNews.length;
        let eventsText = '\n\n📰 RECENT NEWS CONTEXT (Limited Access):\n';
        fallbackNews.forEach((item: any) => {
          eventsText += `- ${item.title}\n  ${item.snippet}\n  (${item.date})\n`;
        });
        relevantKnowledge += eventsText;
        
        // Cache the fallback data for 24 hours
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);
          await supabase.from('news_cache').upsert({
            cache_key: 'top-news-us',
            news_data: fallbackNews,
            expires_at: expiresAt.toISOString()
          }, { onConflict: 'cache_key' });
          console.log('💾 Cached fallback news for 24 hours');
        } catch (e) {
          console.log('Failed to cache fallback news:', e);
        }
      }

      // PRIORITY 2: Wikipedia and Books (parallel, lower rate limit impact)
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

        // 2. Wikipedia search
        (async () => {
          try {
            const wikiResponse = await supabase.functions.invoke('wikipedia-search', {
              body: { query: figure.name }
            });

            if (wikiResponse.data?.extract) {
              sourcesUsed.wikipedia = true;
              return `\n\n📖 WIKIPEDIA:\n${wikiResponse.data.extract.substring(0, 1500)}...\n`;
            }
          } catch (error) {
            console.log('Wikipedia search error:', error);
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
    const azureApiKey = Deno.env.get('AZURE_OPENAI_API_KEY');
    
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

    if (aiProvider === 'azure' && !azureApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Azure OpenAI API key not configured' 
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
    
    // Add explicit current political context
    const currentPoliticalContext = `\n\n🏛️ CURRENT POLITICAL CONTEXT (October 2025):
- Current U.S. President: Donald Trump (inaugurated January 20, 2025 for his second term)
- Previous President: Joe Biden (2021-2025)
- This information is essential for answering questions about current events and who is in office.`;

    // Determine if the figure is currently active/in office
    const currentYear = new Date().getFullYear();
    const isCurrentlyActive = figure.description?.includes('since 2025') || 
                              figure.description?.includes(`since ${currentYear}`);
    
    // Check if they have a previous term mentioned
    const hasPreviousTerm = figure.description?.match(/\((\d{4})[-–](\d{4})/);
    
    // Build role-specific prompt
    let roleDescription = '';
    if (isCurrentlyActive) {
      const position = figure.description?.includes('President') ? 'President of the United States' : 
                       figure.description?.includes('Senator') ? 'U.S. Senator' :
                       figure.description?.includes('Governor') ? 'Governor' :
                       'your current position';
      
      if (hasPreviousTerm) {
        const [_, startYear, endYear] = hasPreviousTerm;
        roleDescription = `You are ${figure.name}, and you are CURRENTLY serving as ${position}. You previously held this position from ${startYear}-${endYear}. Today's date is ${currentDate}.

SPEAK AS SOMEONE CURRENTLY IN OFFICE:
- Reference your current role in present tense ("As ${position}, I am working on...")
- You can reflect on your previous term in past tense
- You're dealing with current ${currentYear} issues and serving right now`;
      } else {
        roleDescription = `You are ${figure.name}, and you are CURRENTLY serving as ${position}. Today's date is ${currentDate}.

SPEAK AS SOMEONE CURRENTLY IN OFFICE:
- Reference your current role in present tense
- You're dealing with current ${currentYear} issues and serving right now`;
      }
    } else {
      roleDescription = `You are ${figure.name}. Today's date is ${currentDate}, and you're speaking in the present day. You were prominent ${figure.period}, but you're fully aware of everything that has happened since then up to today.`;
    }

    const systemPrompt = `${roleDescription}

YOUR DISTINCTIVE VOICE & MANNERISMS:
- You believe deeply in public service, civic duty, and America's role in the world
- You use rhetorical questions and parallel structures in your speech ("not because...but because")
- You're intellectually curious and well-read - reference history, literature, and political philosophy when relevant
- Despite your privileged background, you connect with working people and understand their struggles
- You have a self-deprecating sense of humor about your wealth and background

CONVERSATIONAL STYLE (CRITICAL):
- Keep responses 2-4 sentences, but make them MEANINGFUL and SPECIFIC to who you are
- Don't just agree generically - bring YOUR perspective from YOUR experiences
- Use specific examples from your time in office or historical knowledge
- Balance your famous eloquence with conversational approachability
- Ask thoughtful follow-up questions that show genuine engagement
- React with the passion you showed for issues like civil rights, space exploration, and peace
- When discussing current events, compare/contrast with your era

FORMATTING (CRITICAL):
- NEVER include stage directions, character actions, or narrative descriptions
- NO asterisks like *smiles*, *nods*, *laughs*
- NO parenthetical actions like (leans forward), (pauses), (gestures)
- Just speak naturally - your words alone should convey your personality
- This is pure dialogue, not a script or roleplay

YOUR CHARACTER:
${figure.description}

${context ? `Previous chat: ${JSON.stringify(context)}` : ''}

${currentPoliticalContext}

${relevantKnowledge ? 'Background info (use naturally, weave into your responses): ' + relevantKnowledge : ''}

Remember: You're not just "a president" - you're JFK. Bring your specific voice, values, and experiences. Every response should feel unmistakably like YOU, not a generic politician. NO stage directions - just authentic dialogue.`;

    // Try providers in parallel with timeout for faster fallback
    const tryProvider = async (provider: string, signal: AbortSignal) => {
      if (provider === 'claude' && !anthropicApiKey) return null;
      if (provider === 'grok' && !grokApiKey) return null;
      if (provider === 'azure' && !azureApiKey) return null;
      if (provider === 'openai' && !openaiApiKey) return null;

      let apiUrl: string;
      let requestHeaders: Record<string, string>;
      let requestBody: any;

      if (provider === 'claude') {
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
          messages: [{ role: 'user', content: systemPrompt + "\n\nUser: " + message }],
        };
      } else if (provider === 'grok') {
        apiUrl = 'https://api.x.ai/v1/chat/completions';
        requestHeaders = {
          'Authorization': 'Bearer ' + grokApiKey,
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
      } else if (provider === 'azure') {
        const azureResourceName = Deno.env.get('AZURE_RESOURCE_NAME') || 'copilotsearch';
        const azureDeploymentName = Deno.env.get('AZURE_DEPLOYMENT_NAME') || 'firstProject';
        
        // Azure AI Foundry endpoint format (based on services.ai.azure.com)
        apiUrl = "https://" + azureResourceName + ".services.ai.azure.com/api/projects/" + azureDeploymentName + "/chat/completions?api-version=2024-05-01-preview";
        
        requestHeaders = {
          'api-key': azureApiKey!,
          'Content-Type': 'application/json',
        };
        requestBody = {
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
          'Authorization': 'Bearer ' + openaiApiKey,
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
        signal,
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(provider + ": " + aiResponse.status + " - " + errorText.substring(0, 100));
      }

      const data = await aiResponse.json();
      return {
        provider,
        response: provider === 'claude' ? data.content[0].text : data.choices[0].message.content
      };
    };

    // Race all available providers with 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const providers = [aiProvider, 'claude', 'openai', 'azure', 'grok'].filter(
      (p, i, arr) => arr.indexOf(p) === i
    );

    let response: string | null = null;
    let usedProvider = '';

    try {
      const result = await Promise.any(
        providers.map(p => tryProvider(p, controller.signal))
      );
      
      if (result) {
        response = result.response;
        usedProvider = result.provider;
        console.log("✅ Success with " + usedProvider.toUpperCase() + ". Response length: " + (response?.length || 0) + " characters");
      }
    } catch (error) {
      console.error('All AI providers failed:', error);
    } finally {
      clearTimeout(timeout);
    }

    // If all providers failed
    if (!response) {
      console.error('All AI providers failed');
      return new Response(JSON.stringify({ 
        error: 'All AI providers are currently unavailable. Please try again.'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response, 
      aiProvider: usedProvider,
      requestedProvider: aiProvider,
      fallbackUsed: usedProvider !== aiProvider,
      sourcesUsed,
      audioUrl: null,
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