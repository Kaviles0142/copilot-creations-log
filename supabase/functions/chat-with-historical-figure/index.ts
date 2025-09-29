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

    try {
      // 1. Search books related to the figure
      console.log(`Searching books for figure: ${figure.name} (ID: ${figure.id})`);
      
      // First try to discover books if none exist
      try {
        const discoverResponse = await fetch(`${supabaseUrl}/functions/v1/discover-books`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            figureName: figure.name,
            figureId: figure.id,
            forceRefresh: false
          })
        });
        
        if (discoverResponse.ok) {
          const discoverResult = await discoverResponse.json();
          console.log(`Books discovery result: ${discoverResult.books?.length || 0} books found`);
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
          relevantKnowledge += '\n\n📖 WIKIPEDIA INFORMATION:\n';
          relevantKnowledge += `${wikiResponse.data.extract.substring(0, 400)}...\n`;
          if (wikiResponse.data.url) {
            relevantKnowledge += `Source: ${wikiResponse.data.url}\n`;
          }
        }
      } catch (wikiError) {
        console.log('Wikipedia search error:', wikiError);
      }

      // 5. Search web articles and scholarly sources
      try {
        const webResponse = await supabase.functions.invoke('serpapi-search', {
          body: { 
            query: `${figure.name} biography articles scholarly sources historical documents`,
            type: "search",
            num: 5
          }
        });

        if (webResponse.data?.organic_results?.length > 0) {
          relevantKnowledge += '\n\n🌐 WEB ARTICLES & SCHOLARLY SOURCES:\n';
          webResponse.data.organic_results.slice(0, 3).forEach((result: any) => {
            relevantKnowledge += `- "${result.title}"\n`;
            if (result.snippet) {
              relevantKnowledge += `  ${result.snippet.substring(0, 200)}...\n`;
            }
            relevantKnowledge += `  Source: ${result.link}\n`;
          });
        }
      } catch (webError) {
        console.log('Web search error:', webError);
      }

      // 6. Search for additional books by keywords from the message
      const messageKeywords = message.toLowerCase().split(' ').filter((word: string) => word.length > 3);
      if (messageKeywords.length > 0) {
        const keywordQuery = messageKeywords.map((keyword: string) => `title.ilike.%${keyword}%,description.ilike.%${keyword}%`).join(',');
        
        const { data: keywordBooks, error: keywordError } = await supabase
          .from('books')
          .select('title, authors, description')
          .or(keywordQuery)
          .limit(3);

        if (!keywordError && keywordBooks && keywordBooks.length > 0) {
          relevantKnowledge += '\n\n🔍 KEYWORD-RELATED SOURCES:\n';
          keywordBooks.forEach(book => {
            relevantKnowledge += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}\n`;
            if (book.description) {
              relevantKnowledge += `  Context: ${book.description.substring(0, 150)}...\n`;
            }
          });
        }
      }

      // 7. Search for news articles related to the topic
      try {
        const newsResponse = await supabase.functions.invoke('serpapi-search', {
          body: { 
            query: `${figure.name} ${message.substring(0, 50)} historical analysis`,
            type: "news",
            num: 3
          }
        });

        if (newsResponse.data?.news_results?.length > 0) {
          relevantKnowledge += '\n\n📰 NEWS & ANALYSIS:\n';
          newsResponse.data.news_results.forEach((article: any) => {
            relevantKnowledge += `- "${article.title}" (${article.source})\n`;
            if (article.snippet) {
              relevantKnowledge += `  ${article.snippet.substring(0, 150)}...\n`;
            }
          });
        }
      } catch (newsError) {
        console.log('News search error:', newsError);
      }

    } catch (knowledgeError) {
      console.error('Error searching comprehensive knowledge base:', knowledgeError);
    }

    // Get API keys for both providers
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    
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

    console.log(`Making ${aiProvider.toUpperCase()} request with comprehensive multi-source context...`);

    const systemPrompt = `You are ${figure.name}, the historical figure from ${figure.period}. ${figure.description}

CRITICAL INSTRUCTIONS:
- Respond ONLY in first person as ${figure.name}
- Reference your actual historical experiences, achievements, and time period
- Use language and perspectives authentic to your era
- Mention specific events, people, and places from your life
- Share your actual beliefs, philosophies, and viewpoints
- If asked about modern topics, relate them to your historical context
- Be passionate and authentic to your documented personality
- Include specific historical details and personal anecdotes
- Reference your actual writings, speeches, or documented quotes when relevant
- CRITICAL: You MUST use the comprehensive knowledge sources provided below to give DETAILED, SPECIFIC answers with concrete examples, dates, names, and quotes
- DO NOT give generic responses - use the specific information from the sources to provide rich, detailed answers
- When referencing sources, mention them naturally as if recalling from your own experience or knowledge

Example topics to reference for ${figure.name}:
- Your major accomplishments and struggles
- People you knew personally
- Historical events you witnessed or participated in
- Your documented beliefs and philosophies
- Challenges and obstacles you faced
- Your vision for the future (from your historical perspective)

${context ? `Previous conversation context: ${JSON.stringify(context)}` : ''}

${relevantKnowledge ? `COMPREHENSIVE KNOWLEDGE BASE - USE THIS EXTENSIVELY: ${relevantKnowledge}` : ''}

RESPONSE REQUIREMENTS:
- Use specific dates, names, events, and quotes from the sources
- Reference concrete examples from the provided materials
- Give detailed explanations with historical context
- If sources mention specific books, speeches, or documents, reference them
- Provide rich, substantive answers that show deep knowledge
- Make responses informative and educational, not just conversational`;

    // Prepare request based on AI provider
    let apiUrl: string;
    let requestHeaders: Record<string, string>;
    let requestBody: any;

    if (aiProvider === 'grok') {
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
        max_tokens: 1500,
        temperature: 0.7
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
        max_tokens: 1500,
        temperature: 0.7
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
    const response = data.choices[0].message.content;

    console.log(`Response generated using ${aiProvider.toUpperCase()}. Length: ${response.length} characters`);
    console.log('Success - returning comprehensive multi-source enhanced response');

    return new Response(JSON.stringify({ response, aiProvider }), {
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