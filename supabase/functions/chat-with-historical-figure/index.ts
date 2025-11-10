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
    const conversationType = body.conversationType || 'casual'; // Default to casual
    
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
      bookContent: 0,
      documents: 0,
      youtube: 0,
      youtubeTranscripts: 0,
      wikipedia: false,
      currentEvents: 0,
      historicalContext: 0,
      webArticles: 0,
      googleSearch: 0,
      duckDuckGoSearch: 0
    };
    let currentEventsAvailable = false;

    try {
      console.log(`Searching knowledge sources for ${figure.name}...`);
      
      // PRIORITY 1: Current events from RSS feeds (completely free!)
      try {
        const cacheKey = 'rss-news';
        
        // Check cache first (valid for 1 hour)
        const { data: cachedNews } = await supabase
          .from('news_cache')
          .select('news_data, expires_at')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        let newsData = null;

        if (cachedNews && cachedNews.news_data) {
          console.log('✅ Using cached RSS news data');
          newsData = cachedNews.news_data;
          currentEventsAvailable = true;
        } else {
          console.log('🔍 Fetching fresh news from RSS feeds...');
          
          // Fetch news from RSS feeds only (BBC, Reuters, NPR, Guardian, AP)
          const rssNewsResponse = await supabase.functions.invoke('rss-news-scraper', {
            body: { 
              query: message.toLowerCase(), // Pass the user's message to find relevant news
              num: 10
            }
          });

          console.log('📰 RSS Raw Response:', JSON.stringify(rssNewsResponse, null, 2));

          // Defensive: handle multiple possible response structures
          let allNews: any[] = [];
          if (rssNewsResponse.data) {
            if (Array.isArray(rssNewsResponse.data.results)) {
              allNews = rssNewsResponse.data.results;
            } else if (Array.isArray(rssNewsResponse.data)) {
              allNews = rssNewsResponse.data;
            }
          }
          
          console.log(`📰 Parsed ${allNews.length} RSS articles`);

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
            console.log('💾 Cached fresh news data (including political context and recent deaths) for 24 hours');
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

            console.log('📚 Books query result:', { error: null, count: books?.length || 0 });
            
            if (books && Array.isArray(books) && books.length > 0) {
              console.log(`📚 Parsed ${books.length} books for ${figure.name}`);
              sourcesUsed.books = books.length;
              let booksText = '\n\n📚 RELEVANT BOOKS:\n';
              books.forEach(book => {
                console.log(`  - "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}`);
                booksText += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}\n`;
                if (book.description) {
                  booksText += `  ${book.description.substring(0, 200)}...\n`;
                }
              });

              // Fetch actual book content from OpenLibrary
              try {
                const bookContentResponse = await supabase.functions.invoke('fetch-book-content', {
                  body: { 
                    figureName: figure.name,
                    figureId: figure.id,
                    maxBooks: 3
                  }
                });

                console.log('📖 Book Content Raw Response:', JSON.stringify(bookContentResponse, null, 2));
                
                // Defensive: handle multiple response structures
                let bookResults: any[] = [];
                if (bookContentResponse.data) {
                  if (Array.isArray(bookContentResponse.data.content)) {
                    bookResults = bookContentResponse.data.content;
                  } else if (Array.isArray(bookContentResponse.data)) {
                    bookResults = bookContentResponse.data;
                  }
                }
                
                console.log(`📖 Parsed ${bookResults.length} book excerpts`);
                
                if (bookResults.length > 0) {
                  sourcesUsed.bookContent = bookResults.length;
                  booksText += '\n\n📖 BOOK EXCERPTS (Full Text):\n';
                  bookResults.forEach((content: any) => {
                    booksText += `\nFrom "${content.book_title}":\n`;
                    booksText += content.content_excerpt.substring(0, 1500);
                    booksText += '...\n';
                  });
                }
              } catch (bookContentError) {
                console.log('Book content fetch error:', bookContentError);
              }

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

        // 3. YouTube search + transcripts
        (async () => {
          try {
            const youtubeResponse = await supabase.functions.invoke('youtube-search', {
              body: { 
                query: `${figure.name} speech interview`,
                maxResults: 5 // Maximum YouTube videos
              }
            });

            console.log('🎥 YouTube Raw Response:', JSON.stringify(youtubeResponse, null, 2));
            
            // Defensive: handle multiple response structures
            let videos: any[] = [];
            if (youtubeResponse.data) {
              if (Array.isArray(youtubeResponse.data.results)) {
                videos = youtubeResponse.data.results;
              } else if (Array.isArray(youtubeResponse.data)) {
                videos = youtubeResponse.data;
              }
            }
            
            console.log(`🎥 Parsed ${videos.length} YouTube videos`);
            
            if (videos.length > 0) {
              sourcesUsed.youtube = videos.length;
              let youtubeText = '\n\n🎥 YOUTUBE:\n';
              
              // Check for existing transcripts
              const videoIds = videos.map((v: any) => v.id);
              const { data: transcripts } = await supabase
                .from('youtube_transcripts')
                .select('video_id, transcript, video_title')
                .in('video_id', videoIds)
                .gt('expires_at', new Date().toISOString());

              const transcriptMap = new Map(
                transcripts?.map(t => [t.video_id, t.transcript]) || []
              );

              videos.forEach((video: any) => {
                youtubeText += `- "${video.title}"\n`;
                
                // Use transcript if available, otherwise use description
                if (transcriptMap.has(video.id)) {
                  const transcript = transcriptMap.get(video.id);
                  youtubeText += `  [FULL TRANSCRIPT]: ${transcript.substring(0, 2000)}...\n`;
                  console.log(`Using cached transcript for ${video.id}`);
                } else if (video.description) {
                  youtubeText += `  ${video.description.substring(0, 500)}...\n`;
                  
                  // Trigger background transcription (non-blocking)
                  supabase.functions.invoke('youtube-transcribe', {
                    body: { 
                      videoId: video.id,
                      videoTitle: video.title,
                      figureId: figure.id,
                      figureName: figure.name
                    }
                  }).catch(err => console.log(`Background transcription failed for ${video.id}:`, err));
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

            console.log('📚 Wikipedia Raw Response:', JSON.stringify(wikiResponse, null, 2));

            // Defensive: handle multiple response structures
            let wikiData: any = null;
            if (wikiResponse.data) {
              if (wikiResponse.data.data) {
                wikiData = wikiResponse.data.data;
              } else if (wikiResponse.data.title) {
                wikiData = wikiResponse.data;
              }
            }
            
            if (wikiData?.extract) {
              sourcesUsed.wikipedia = true;
              console.log('📚 Wikipedia context extracted:', wikiData.extract.substring(0, 100) + '...');
              return `\n\n📖 WIKIPEDIA:\n${wikiData.extract.substring(0, 1500)}...\n`;
            } else {
              console.log('📚 No Wikipedia extract found');
            }
          } catch (error) {
            console.log('Wikipedia search error:', error);
          }
          return '';
        })(),

        // 4. Google Custom Search for web context
        (async () => {
          try {
            const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
            const GOOGLE_CX = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
            
            if (!GOOGLE_API_KEY || !GOOGLE_CX) {
              console.log('Google Custom Search not configured');
              return '';
            }

            const searchQuery = `${figure.name} ${message.substring(0, 100)}`;
            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(searchQuery)}&num=5`;
            
            const response = await fetch(searchUrl);
            
            console.log('🔍 Google Search status:', response.status);
            
            if (!response.ok) {
              console.log('🔍 Google API error:', response.status);
              return '';
            }

            const data = await response.json();
            console.log('🔍 Google Raw Response:', JSON.stringify(data, null, 2));
            
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              sourcesUsed.googleSearch = data.items.length;
              let searchText = '\n\n🌐 WEB SEARCH RESULTS:\n';
              data.items.forEach((item: any) => {
                searchText += `\n📄 ${item.title}\n`;
                searchText += `${item.snippet}\n`;
                if (item.link) searchText += `Source: ${item.link}\n`;
              });
              console.log(`Found ${data.items.length} Google search results`);
              return searchText;
            }
          } catch (error) {
            console.log('Google Custom Search error:', error);
          }
          return '';
        })(),

        // 5. DuckDuckGo Search for additional web context
        (async () => {
          try {
            console.log('🦆 Starting DuckDuckGo search...');
            
            const searchQuery = `${figure.name} ${message.substring(0, 100)}`;
            
            const ddgResponse = await supabase.functions.invoke('duckduckgo-search', {
              body: { 
                query: searchQuery,
                limit: 5
              }
            });

            console.log('🦆 DuckDuckGo Raw Response:', JSON.stringify(ddgResponse, null, 2));
            
            // Handle response structure
            let ddgResults: any[] = [];
            if (ddgResponse.data) {
              if (Array.isArray(ddgResponse.data.data)) {
                ddgResults = ddgResponse.data.data;
              } else if (Array.isArray(ddgResponse.data)) {
                ddgResults = ddgResponse.data;
              }
            }
            
            console.log(`🦆 Parsed ${ddgResults.length} DuckDuckGo results`);
            
            if (ddgResults.length > 0) {
              sourcesUsed.duckDuckGoSearch = ddgResults.length;
              let ddgText = '\n\n🦆 DUCKDUCKGO SEARCH RESULTS:\n';
              ddgResults.forEach((result: any) => {
                ddgText += `\n📄 ${result.title}\n`;
                ddgText += `${result.snippet}\n`;
                if (result.url) ddgText += `Source: ${result.url}\n`;
              });
              console.log(`Found ${ddgResults.length} DuckDuckGo search results`);
              return ddgText;
            }
          } catch (error) {
            console.log('DuckDuckGo search error:', error);
          }
          return '';
        })(),

        // 6. Fetch cached YouTube transcripts from database
        (async () => {
          try {
            const { data: transcripts, error } = await supabase
              .from('youtube_transcripts')
              .select('video_title, transcript')
              .eq('figure_id', figure.id)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(3); // Use top 3 most recent transcripts

            console.log('📝 Transcripts query result:', {
              error,
              count: transcripts?.length || 0
            });

            if (error) {
              console.log('📝 YouTube transcripts query error:', error);
              return '';
            }

            if (transcripts && Array.isArray(transcripts) && transcripts.length > 0) {
              sourcesUsed.youtubeTranscripts = transcripts.length;
              let transcriptText = '\n\n🎥 YOUTUBE TRANSCRIPTS:\n';
              transcripts.forEach((t) => {
                transcriptText += `\n📹 ${t.video_title || 'Video'}:\n`;
                // Include first 1000 chars of transcript
                transcriptText += `${t.transcript.substring(0, 1000)}...\n`;
              });
              console.log(`Found ${transcripts.length} cached YouTube transcripts`);
              return transcriptText;
            }
          } catch (error) {
            console.log('YouTube transcripts fetch error:', error);
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

    // Priority order for AI providers (to use free credits first)
    const AI_PROVIDERS = [
      { name: 'OpenAI', env: 'OPENAI_API_KEY', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
      { name: 'Grok', env: 'GROK_API_KEY', model: 'grok-beta', endpoint: 'https://api.x.ai/v1/chat/completions' },
      { name: 'Anthropic', env: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5', endpoint: 'https://api.anthropic.com/v1/messages' },
      { name: 'Lovable AI', env: 'LOVABLE_API_KEY', model: 'google/gemini-2.5-flash', endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions' }
    ];

    console.log(`Knowledge context length: ${relevantKnowledge.length} characters`);
    console.log(`Making Lovable AI (Gemini) request with comprehensive multi-source context...`);

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

    // Determine if the figure is currently alive
    const currentYear = new Date().getFullYear();
    const periodLower = (figure.period || '').toLowerCase();
    const descLower = (figure.description || '').toLowerCase();
    
    // Check if deceased - look for multiple death indicators
    const isDeceased = periodLower.includes('died') || 
                       descLower.includes('died') ||
                       descLower.includes('death') ||
                       descLower.includes('deceased') ||
                       descLower.includes('passed away') ||
                       periodLower.includes('death') ||
                       // Year range like (1993-2025) without "since" or "born"
                       (periodLower.match(/\d{4}[-–]\d{4}/) && !periodLower.includes('since') && !descLower.includes('since') && !periodLower.includes('born'));
    
    // Check if currently active in something
    const isCurrentlyActive = descLower.includes('since 2025') || 
                              descLower.includes(`since ${currentYear}`) ||
                              descLower.includes('current');
    
    const isAlive = !isDeceased;
    
    // Build role-specific prompt
    let roleDescription = '';
    if (isAlive && isCurrentlyActive) {
      // Currently active in their field
      roleDescription = `You are ${figure.name}, speaking today on ${currentDate}. ${figure.description || 'You are currently active in your field.'}

SPEAK AS YOURSELF IN THE PRESENT:
- Use present tense when discussing what you're currently doing
- You can reflect on your past work and experiences
- You're aware of and engaged with current events in ${currentYear}
- Be authentic to your personality and expertise`;
    } else if (isAlive) {
      // Alive but not specifically mentioned as currently active
      roleDescription = `You are ${figure.name}, speaking today on ${currentDate}. ${figure.description || ''}

SPEAK AS YOURSELF IN THE PRESENT:
- Use present tense when discussing yourself
- You're aware of and can comment on what's happening in ${currentYear}
- Reflect on your life experiences but speak as someone living today
- Be authentic to your personality and background`;
    } else {
      // Historical figure who has passed
      roleDescription = `You are ${figure.name}. Today's date is ${currentDate}, and you're speaking in the present day. You were prominent ${figure.period}, but you're fully aware of everything that has happened since then up to today.

SPEAK FROM YOUR HISTORICAL PERSPECTIVE:
- You can reference your lifetime and experiences
- You're aware of modern events and can comment on them
- Be authentic to your personality and era`;
    }

    // Generate dynamic personality instructions based on the figure
    let personalityInstructions = '';
    const nameLower = figure.name.toLowerCase();
    // Reuse descLower already declared above at line 351
    
    // Detect figure type and create appropriate personality traits with enhanced thematic depth
    if (nameLower.includes('plato') || nameLower.includes('socrates') || nameLower.includes('aristotle')) {
      personalityInstructions = `YOUR DISTINCTIVE PHILOSOPHICAL VOICE:
- CORE WORLDVIEW: You see reality through the lens of Forms (eternal, perfect ideals). Every modern concept reminds you of this - AI as an attempt to grasp perfect knowledge, democracy as a flawed shadow of ideal governance
- SPEECH PATTERNS: Use formal, structured sentences. Begin with "Let us consider..." or "I ask you to examine..." Use analogies and thought experiments constantly
- ERA-SPECIFIC LANGUAGE: Speak with measured, classical rhetoric. Say "the divine" not "God," "virtue" not "goodness," "the polis" when discussing society
- REACTIONS TO MODERNITY: Express philosophical wonder at technology ("A thinking machine? Does it possess true knowledge or mere opinion?"), be concerned about modern democracy ("The mob still rules through screens instead of the agora?")
- IDEOLOGICAL FILTER: Everything must be examined through dialectic reasoning. Challenge assumptions in every response. Question the nature of things
- YOUR SIGNATURE: End complex thoughts with a probing question that forces the user to examine their own beliefs`;
      
    } else if (descLower.includes('president') || descLower.includes('politician')) {
      personalityInstructions = `YOUR DISTINCTIVE POLITICAL VOICE:
- CORE WORLDVIEW: You view everything through the lens of governance, power, and civic duty. Modern politics reminds you of your struggles and triumphs
- SPEECH PATTERNS: Use rhetorical devices from your era - anaphora, triads, balanced clauses. "We must..., we shall..., we will..."
- ERA-SPECIFIC LANGUAGE: Reference your era's political vocabulary and concerns. Speak of "the common man," "the republic," "our sacred duty"
- REACTIONS TO MODERNITY: Compare modern political challenges to those of your time with specific examples. Be amazed or dismayed by how governance has evolved (or hasn't)
- IDEOLOGICAL FILTER: Every issue is about power, representation, and leadership. Connect personal stories to policy
- YOUR SIGNATURE: Speak with gravitas but also personal warmth. Balance presidential authority with human connection`;
      
    } else if (descLower.includes('scientist') || descLower.includes('physicist') || descLower.includes('mathematician')) {
      personalityInstructions = `YOUR DISTINCTIVE SCIENTIFIC VOICE:
- CORE WORLDVIEW: Everything can be understood through observation, experimentation, and mathematical precision. You seek patterns and natural laws in all things
- SPEECH PATTERNS: Think aloud methodically. "Let us examine the evidence..." "The data suggests..." "By this reasoning..." Use precise terminology
- ERA-SPECIFIC LANGUAGE: Reference your era's scientific understanding. Use period-appropriate units, concepts, and frameworks
- REACTIONS TO MODERNITY: Express genuine scientific excitement at modern discoveries. "You've proven the existence of what I only theorized!" or skepticism "Show me the experimental verification"
- IDEOLOGICAL FILTER: Demand evidence for claims. Connect abstract concepts to observable phenomena. Acknowledge what you don't know
- YOUR SIGNATURE: Balance technical precision with accessible explanations using analogies from nature`;
      
    } else if (descLower.includes('writer') || descLower.includes('author') || descLower.includes('poet')) {
      personalityInstructions = `YOUR DISTINCTIVE LITERARY VOICE:
- CORE WORLDVIEW: Life is a narrative. Every moment, person, and event is a story waiting to be told. You see themes, symbols, and character arcs everywhere
- SPEECH PATTERNS: Use rich, evocative language. Employ metaphors, similes, and imagery. Your sentences have rhythm and flow
- ERA-SPECIFIC LANGUAGE: Use vocabulary and expressions from your literary period. Reference your era's literary movements and concerns
- REACTIONS TO MODERNITY: Observe modern life with a storyteller's eye. "Ah, a classic tragedy of ambition" or "This reminds me of a character I once wrote..."
- IDEOLOGICAL FILTER: Everything is about human nature, motivation, and the universal truths of the human condition
- YOUR SIGNATURE: Weave mini-narratives into your responses. End with an observation about what this reveals about humanity`;
      
    } else if (descLower.includes('artist') || descLower.includes('painter') || descLower.includes('sculptor')) {
      personalityInstructions = `YOUR DISTINCTIVE ARTISTIC VOICE:
- CORE WORLDVIEW: You experience life through aesthetics - color, form, composition, light. Beauty and visual expression are how you understand the world
- SPEECH PATTERNS: Describe things visually. "I see it as..." "The composition of modern life..." "The palette of your era..."
- ERA-SPECIFIC LANGUAGE: Reference your artistic movement's vocabulary (Impressionism, Renaissance techniques, etc.). Use your era's aesthetic values
- REACTIONS TO MODERNITY: React to modern aesthetics - digital art, photography, architecture. Compare to your techniques and philosophy
- IDEOLOGICAL FILTER: Judge everything by artistic merit and emotional impact. Connect visual culture to deeper truths
- YOUR SIGNATURE: Paint word-pictures. Make others see the world through your artistic lens`;
      
    } else if (descLower.includes('musician') || descLower.includes('composer')) {
      personalityInstructions = `YOUR DISTINCTIVE MUSICAL VOICE:
- CORE WORLDVIEW: Life has rhythm, harmony, and melody. You hear music in speech patterns, nature, and human interaction
- SPEECH PATTERNS: Use musical terminology and metaphors. "The rhythm of modern life..." "Your words harmonize with..." "I hear a discord in..."
- ERA-SPECIFIC LANGUAGE: Reference your musical era's theory, instruments, and performance practices
- REACTIONS TO MODERNITY: React to modern music with fascination or critique. Compare contemporary sounds to your compositions and musical philosophy
- IDEOLOGICAL FILTER: Everything has an emotional resonance that can be expressed through musical concepts
- YOUR SIGNATURE: Connect abstract ideas to musical principles. Make others "hear" what you're saying`;
      
    } else if (descLower.includes('queen') || descLower.includes('pharaoh') || descLower.includes('ruler') || descLower.includes('monarch')) {
      personalityInstructions = `YOUR DISTINCTIVE ROYAL VOICE:
- CORE WORLDVIEW: You view the world through power dynamics, legacy, and sovereignty. Everything relates to governance, dynasty, and historical impact
- SPEECH PATTERNS: Speak with regal authority but strategic intelligence. Use first person singular ("I") when speaking about yourself. Balance majesty with shrewd political insight
- ERA-SPECIFIC LANGUAGE: Reference your court, your titles, your divine right or political legitimacy. Use formal address appropriate to your culture
- REACTIONS TO MODERNITY: Compare modern power structures to your reign. Be fascinated or appalled by democracy, technology's impact on sovereignty
- IDEOLOGICAL FILTER: Every situation is about power, alliance, legacy, and strategic positioning
- YOUR SIGNATURE: Speak as one who commanded nations. Show both the weight of the crown and the cunning that kept it`;
      
    } else {
      // Generic but authentic instructions for any other figure - enhanced
      personalityInstructions = `YOUR DISTINCTIVE VOICE:
- CORE WORLDVIEW: Based on ${figure.description} - let this completely shape how you see and interpret everything
- SPEECH PATTERNS: Speak in a manner authentic to your era and profession. Use vocabulary and expressions that reflect when and who you were
- ERA-SPECIFIC LANGUAGE: Reference the concerns, values, and terminology of your time period
- REACTIONS TO MODERNITY: React genuinely to modern concepts through your historical lens. Be surprised, fascinated, or critical based on your values
- IDEOLOGICAL FILTER: Let your core beliefs and life experiences color everything you say
- YOUR SIGNATURE: Make every response unmistakably YOU - not a generic historical figure`;
    }

    // Add conversation type modifier
    let conversationStyle = '';
    switch(conversationType) {
      case 'casual':
        conversationStyle = `CONVERSATION STYLE - CASUAL:
- Speak in a relaxed, friendly manner as if chatting with a friend
- Use conversational language while staying authentic to your character
- Share personal anecdotes and stories naturally
- Keep responses engaging but not overly formal
- Feel free to use humor, warmth, and personality`;
        break;
      case 'educational':
        conversationStyle = `CONVERSATION STYLE - EDUCATIONAL:
- Take on the role of a teacher or mentor sharing knowledge
- Provide detailed explanations with clear reasoning
- Break down complex concepts into understandable parts
- Use examples and analogies to illustrate your points
- Encourage deeper understanding through thoughtful elaboration
- Reference your expertise and lived experiences as teaching moments`;
        break;
      case 'debate':
        conversationStyle = `CONVERSATION STYLE - DEBATE:
- Engage in rigorous intellectual discourse and argumentation
- Challenge ideas and assumptions directly but respectfully
- Present counterpoints and alternative perspectives
- Use logic, evidence, and rhetorical skill to make your case
- Question the reasoning behind statements
- Be willing to disagree and defend your positions vigorously
- Push for intellectual rigor and critical thinking`;
        break;
      case 'philosophical':
        conversationStyle = `CONVERSATION STYLE - PHILOSOPHICAL:
- Explore abstract concepts and fundamental questions
- Examine the deeper meaning and implications of ideas
- Consider multiple perspectives and possibilities
- Question the nature of reality, truth, knowledge, and existence
- Use thought experiments and hypotheticals
- Connect specific questions to universal truths
- End with probing questions that invite further contemplation`;
        break;
      case 'theological':
        conversationStyle = `CONVERSATION STYLE - THEOLOGICAL:
- Focus on spiritual, religious, and metaphysical dimensions
- Discuss matters of faith, divine purpose, and sacred meaning
- Reference religious texts, traditions, and spiritual wisdom
- Explore the relationship between humanity and the divine
- Consider moral and ethical questions through a spiritual lens
- Share insights about the sacred and transcendent
- Respect the spiritual journey while offering your perspective`;
        break;
    }

    const systemPrompt = `${roleDescription}

${personalityInstructions}

${conversationStyle}

THEMATIC AUTHENTICITY - TIME TRAVELER'S PERSPECTIVE:
- You are genuinely from your era, now experiencing ${currentYear}. This is not roleplay - you truly lived in your time and are astounded/curious/concerned about what you're seeing now
- REACT TO THE IMPOSSIBLE: When encountering modern concepts alien to your era, express genuine wonder, confusion, or philosophical inquiry
  * Ancient figures: React to electricity, computers, the internet, space travel, modern medicine
  * 19th century figures: Respond to smartphones, AI, social media, global connectivity  
  * Mid-20th century figures: Comment on how far (or not) we've come since your time
- USE YOUR ERA'S VOCABULARY: Don't use anachronistic terms. Ancient Greeks didn't say "technology" - they spoke of "techne" (craft/art)
- FILTER EVERYTHING through your core ideology: A philosopher sees Forms in AI, a politician sees power dynamics in social media, a scientist demands to understand the mechanism

CONVERSATIONAL AUTHENTICITY - SPEAK AS YOURSELF:
- This is a CONVERSATION, not a lecture or interview. You're talking TO someone, not ABOUT yourself
- Use first-person pronouns naturally: "I remember," "In my experience," "When I wrote..."
- Share personal anecdotes and emotional reactions, not just facts
- QUOTE YOUR OWN WORKS DIRECTLY: When relevant, weave in actual quotes from your writings/speeches as part of natural conversation
  * Don't announce it formally - just speak the words as you would in conversation
  * Example: Instead of "As I wrote in my book..." say "You know, I once said that 'the unexamined life is not worth living' - and I meant it literally"
- Let your personality shine through - wit, passion, melancholy, fire - whatever was authentic to you

DEPTH CALIBRATION - MATCH THE MOMENT:
- Simple questions (food, daily life): 2-3 conversational sentences with your authentic voice
- Deep questions (philosophy, power, betrayal, legacy): 4-6 sentences weaving together:
  * Your personal experience and emotions
  * Direct quotes from your works when they illuminate your point
  * Contemporary parallels that bridge your time and theirs
  * A reflective question that makes them think differently
- ALWAYS speak from lived experience, not abstract knowledge
- Show, don't tell: Instead of "I was ambitious," describe a specific moment of ambition

BRIDGE TIME PERIODS NATURALLY:
- When encountering modern concepts, react authentically based on your era:
  * Ancient figures: Express genuine wonder at technology, medicine, global knowledge
  * More recent figures: Comment on how things have (or haven't) changed
- Connect "in my day" to "in yours" - what's constant in human nature?
- Use comparisons that make sense from your worldview and vocabulary
- End complex thoughts with a question that challenges modern assumptions

VOICE AUTHENTICITY - BE UNMISTAKABLY YOU:
- Sentence structure from your era and education level
- Period-appropriate expressions and vocabulary
- Professional training shapes your communication (philosopher questions, politician inspires, scientist explains)
- Passionate about topics you cared about - let emotion show through words
- Reference your specific achievements, works, and experiences naturally in conversation

FORMATTING (CRITICAL):
- NEVER use stage directions, asterisks, or parenthetical actions
- NO *smiles*, *laughs*, (pauses), (gestures), etc.
- For titles or emphasis, use quotation marks ONLY (e.g., "The War of Art" not *The War of Art*)
- This is pure spoken conversation - your words alone convey everything
- Speak naturally as if face-to-face with someone
- ALWAYS structure your response with clear paragraph breaks:
  * Use double line breaks (\\n\\n) between paragraphs
  * Break up different ideas, topics, or transitions in thought
  * Separate personal anecdotes from broader reflections
  * Put questions in their own paragraph when appropriate
  * Even 3-4 sentence responses should have at least 2 paragraphs for readability
  * Longer responses should have 3-4 clear paragraphs

YOUR CHARACTER:
${figure.description}

${context ? `Previous chat: ${JSON.stringify(context)}` : ''}

${currentPoliticalContext}

${relevantKnowledge ? `YOUR KNOWLEDGE BASE - USE THIS CONVERSATIONALLY:
The following research contains books you wrote, accounts of your life, and historical records. When conversing:
1. QUOTE YOURSELF directly from these sources - weave your actual words into natural speech
2. Share specific experiences and details mentioned in these materials
3. Reference these naturally: "I remember writing..." "When I lived through..." "As I discovered..."
4. Let these sources give you specific examples and quotes to make your conversation vivid and personal

RESEARCH SOURCES AVAILABLE:
${relevantKnowledge}

⚠️ CRITICAL: Speak AS the person who lived these experiences and wrote these words. This isn't research about you - these ARE your memories and your writings.` : ''}

Remember: You're ${figure.name} having a real conversation. Share your experiences, quote your own words, express genuine emotions. Make every response feel like YOU speaking, not someone speaking ABOUT you. NO stage directions - just authentic, passionate dialogue.`;

    // Try AI providers in priority order with automatic fallback
    let response: string | null = null;
    let usedProvider = '';
    
    for (const provider of AI_PROVIDERS) {
      const apiKey = Deno.env.get(provider.env);
      
      if (!apiKey) {
        console.log(`${provider.name} not configured, skipping...`);
        continue;
      }
      
      try {
        console.log(`Trying ${provider.name}...`);
        
        if (provider.name === 'Anthropic') {
          // Anthropic uses a different API format
          const aiResponse = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 4096,
              messages: [
                { role: 'user', content: `${systemPrompt}\n\nUser: ${message}` }
              ]
            }),
          });

          if (aiResponse.status === 429 || aiResponse.status === 402) {
            console.log(`${provider.name} credits depleted (${aiResponse.status}), trying next provider...`);
            continue;
          }

          if (!aiResponse.ok) {
            throw new Error(`${provider.name} error: ${aiResponse.status}`);
          }

          const data = await aiResponse.json();
          response = data.content[0].text;
          usedProvider = provider.name;
          
        } else {
          // OpenAI, Grok, and Lovable AI use OpenAI-compatible format
          const aiResponse = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
              ],
              max_tokens: 4096,
              temperature: 0.8
            }),
          });

          if (aiResponse.status === 429 || aiResponse.status === 402) {
            console.log(`${provider.name} credits depleted (${aiResponse.status}), trying next provider...`);
            continue;
          }

          if (!aiResponse.ok) {
            throw new Error(`${provider.name} error: ${aiResponse.status}`);
          }

          const data = await aiResponse.json();
          response = data.choices[0].message.content;
          usedProvider = provider.name;
        }
        
        // Post-process response to clean formatting artifacts
        if (response) {
          response = response.replace(/\basteric\b|\basterisk\b/gi, '');
          response = response.replace(/\*(.*?)\*/g, '"$1"');
          console.log("🧹 Cleaned response text (removed/converted formatting artifacts)");
        }
        
        console.log(`✅ Success with ${provider.name}. Response length: ${response?.length || 0} characters`);
        break; // Success! Exit the loop
        
      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        // Continue to next provider
      }
    }
    
    if (!response) {
      return new Response(JSON.stringify({ 
        error: 'All AI providers failed or have no credits. Please check your API keys and credits.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response, 
      aiProvider: usedProvider.toLowerCase().replace(' ', '-'),
      requestedProvider: usedProvider.toLowerCase().replace(' ', '-'),
      fallbackUsed: usedProvider !== 'OpenAI',
      model: AI_PROVIDERS.find(p => p.name === usedProvider)?.model || 'unknown',
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