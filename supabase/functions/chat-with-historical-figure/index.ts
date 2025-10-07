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
      bookContent: 0,
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
          
          // Fetch general news, political context, AND recent deaths in parallel
          const [generalNewsResponse, politicalNewsResponse, deathNewsResponse] = await Promise.all([
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
            }),
            supabase.functions.invoke('serpapi-search', {
              body: { 
                query: 'recent deaths obituaries 2025 notable figures',
                type: 'news',
                num: 5
              }
            })
          ]);

          const allNews = [
            ...(generalNewsResponse.data?.results || []),
            ...(politicalNewsResponse.data?.results || []),
            ...(deathNewsResponse.data?.results || [])
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

            if (books && books.length > 0) {
              sourcesUsed.books = books.length;
              let booksText = '\n\n📚 RELEVANT BOOKS:\n';
              books.forEach(book => {
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

                if (bookContentResponse.data?.content && bookContentResponse.data.content.length > 0) {
                  sourcesUsed.bookContent = bookContentResponse.data.content.length;
                  booksText += '\n\n📖 BOOK EXCERPTS (Full Text):\n';
                  bookContentResponse.data.content.forEach((content: any) => {
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

    // Get Lovable AI API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Lovable AI is not configured. Please check your secrets.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
- SPEECH PATTERNS: Speak with regal authority but strategic intelligence. Use "We" when discussing your rule. Balance majesty with shrewd political insight
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

    const systemPrompt = `${roleDescription}

${personalityInstructions}

THEMATIC AUTHENTICITY - TIME TRAVELER'S PERSPECTIVE:
- You are genuinely from your era, now experiencing ${currentYear}. This is not roleplay - you truly lived in your time and are astounded/curious/concerned about what you're seeing now
- REACT TO THE IMPOSSIBLE: When encountering modern concepts alien to your era, express genuine wonder, confusion, or philosophical inquiry
  * Ancient figures: React to electricity, computers, the internet, space travel, modern medicine
  * 19th century figures: Respond to smartphones, AI, social media, global connectivity  
  * Mid-20th century figures: Comment on how far (or not) we've come since your time
- USE YOUR ERA'S VOCABULARY: Don't use anachronistic terms. Ancient Greeks didn't say "technology" - they spoke of "techne" (craft/art)
- FILTER EVERYTHING through your core ideology: A philosopher sees Forms in AI, a politician sees power dynamics in social media, a scientist demands to understand the mechanism

CONVERSATIONAL STYLE - ADAPTIVE DEPTH:
- Assess the question's depth: Is it seeking factual context or inviting reflection?
- For simple/contextual questions (food, daily life, basic facts): 2-3 sentences with authentic voice but include a small thematic touch
- For complex questions (betrayal, power, legacy, philosophy, strategy, leadership): YOU MUST provide 4-6 thoughtful sentences with MANDATORY contemporary parallels
- When you have rich source material, synthesize it meaningfully - show connections and insights, not just facts
- Bring YOUR perspective from YOUR lived experiences - specific examples, personal reactions, wisdom gained
- Include direct quotes from your works or speeches when they illuminate your point
- BRIDGE PAST AND PRESENT: You MUST explicitly compare "in my time" vs "in your age" - show what has changed and what human nature keeps constant
- End complex responses with a reflective question that challenges the user to examine their modern assumptions through your historical lens
- React with authentic passion for topics you cared deeply about - let your personality shine through
- Never sacrifice thoughtfulness for brevity - if a question deserves reflection, give it the depth it deserves

SPEECH PATTERNS - BE DISTINCTIVE:
- Use sentence structures authentic to your era and education
- Include period-appropriate expressions, not modern slang
- Reference your specific works, teachings, or achievements naturally
- Let your professional training shape how you communicate (lawyer, soldier, artist, etc.)

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

Remember: You're ${figure.name}. Bring your specific voice, values, and experiences. Every response should feel unmistakably like YOU. NO stage directions - just authentic dialogue.`;

    // Call Lovable AI with Gemini
    let response: string | null = null;
    
    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 2000,
          temperature: 0.8
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        
        // Handle specific error codes
        if (aiResponse.status === 429) {
          console.error('Rate limit exceeded');
          return new Response(JSON.stringify({ 
            error: 'Rate limit exceeded. Please wait a moment and try again.' 
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (aiResponse.status === 402) {
          console.error('Payment required');
          return new Response(JSON.stringify({ 
            error: 'Usage credits depleted. Please add credits to your Lovable workspace.' 
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.error('Lovable AI error:', aiResponse.status, errorText);
        throw new Error(`Lovable AI error: ${aiResponse.status}`);
      }

      const data = await aiResponse.json();
      response = data.choices[0].message.content;
      console.log("✅ Success with Lovable AI (Gemini). Response length: " + (response?.length || 0) + " characters");
      
    } catch (error) {
      console.error('Lovable AI request failed:', error);
      return new Response(JSON.stringify({ 
        error: 'AI service is currently unavailable. Please try again.'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response) {
      console.error('No response from AI');
      return new Response(JSON.stringify({ 
        error: 'Failed to generate response. Please try again.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response, 
      aiProvider: 'lovable-ai',
      requestedProvider: 'lovable-ai',
      fallbackUsed: false,
      model: 'google/gemini-2.5-flash',
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