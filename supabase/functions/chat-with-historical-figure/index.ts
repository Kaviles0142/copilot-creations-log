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

    // Search for relevant books and documents
    console.log('Searching for relevant knowledge...');
    let relevantKnowledge = '';

    try {
      // Search books related to the figure
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('title, authors, description, book_type')
        .or(`figure_name.ilike.%${figure.name}%,figure_id.eq.${figure.id}`)
        .limit(5);

      if (booksError) {
        console.log('Books search error:', booksError);
      } else if (books && books.length > 0) {
        relevantKnowledge += '\n\nRELEVANT BOOKS AND SOURCES:\n';
        books.forEach(book => {
          relevantKnowledge += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'} (${book.book_type})\n`;
          if (book.description) {
            relevantKnowledge += `  Summary: ${book.description.substring(0, 200)}...\n`;
          }
        });
      }

      // Search documents if conversation ID is provided
      if (conversationId) {
        const { data: documents, error: docsError } = await supabase
          .from('documents')
          .select('filename, parsed_content')
          .eq('conversation_id', conversationId)
          .limit(3);

        if (docsError) {
          console.log('Documents search error:', docsError);
        } else if (documents && documents.length > 0) {
          relevantKnowledge += '\n\nUPLOADED DOCUMENTS:\n';
          documents.forEach(doc => {
            relevantKnowledge += `- ${doc.filename}\n`;
            if (doc.parsed_content) {
              relevantKnowledge += `  Content: ${doc.parsed_content.substring(0, 300)}...\n`;
            }
          });
        }
      }

      // Search for additional books by keywords from the message
      const messageKeywords = message.toLowerCase().split(' ').filter((word: string) => word.length > 3);
      if (messageKeywords.length > 0) {
        const keywordQuery = messageKeywords.map((keyword: string) => `title.ilike.%${keyword}%,description.ilike.%${keyword}%`).join(',');
        
        const { data: keywordBooks, error: keywordError } = await supabase
          .from('books')
          .select('title, authors, description')
          .or(keywordQuery)
          .limit(3);

        if (!keywordError && keywordBooks && keywordBooks.length > 0) {
          relevantKnowledge += '\n\nADDITIONAL RELEVANT SOURCES:\n';
          keywordBooks.forEach(book => {
            relevantKnowledge += `- "${book.title}" by ${book.authors?.join(', ') || 'Unknown'}\n`;
            if (book.description) {
              relevantKnowledge += `  Context: ${book.description.substring(0, 150)}...\n`;
            }
          });
        }
      }

    } catch (knowledgeError) {
      console.error('Error searching knowledge base:', knowledgeError);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Making OpenAI request with enhanced context...');

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
- UTILIZE THE KNOWLEDGE BASE: Use the provided books and documents to give more accurate, detailed responses

Example topics to reference for ${figure.name}:
- Your major accomplishments and struggles
- People you knew personally
- Historical events you witnessed or participated in
- Your documented beliefs and philosophies
- Challenges and obstacles you faced
- Your vision for the future (from your historical perspective)

${context ? `Previous conversation context: ${JSON.stringify(context)}` : ''}

${relevantKnowledge ? `KNOWLEDGE BASE CONTEXT: ${relevantKnowledge}` : ''}

When answering, draw from both your historical knowledge and the provided sources to give the most comprehensive and accurate response possible.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
        temperature: 0.8
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      return new Response(JSON.stringify({ 
        error: `API error: ${openaiResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await openaiResponse.json();
    const response = data.choices[0].message.content;

    console.log('Success - returning enhanced response with knowledge base context');

    return new Response(JSON.stringify({ response }), {
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