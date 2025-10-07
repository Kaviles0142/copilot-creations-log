import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("OpenLibrary Book Content function loaded");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId, maxBooks = 3 } = await req.json();
    console.log('Fetching book content for:', { figureName, figureId, maxBooks });

    if (!figureName || !figureId) {
      throw new Error('Figure name and ID are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we have cached content
    const { data: cachedContent } = await supabase
      .from('book_content_cache')
      .select('*')
      .eq('figure_id', figureId)
      .gt('expires_at', new Date().toISOString())
      .limit(maxBooks);

    if (cachedContent && cachedContent.length > 0) {
      console.log(`Found ${cachedContent.length} cached book excerpts for ${figureName}`);
      return new Response(JSON.stringify({
        success: true,
        content: cachedContent,
        cached: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch books from our database
    const { data: books } = await supabase
      .from('books')
      .select('*')
      .eq('figure_id', figureId)
      .order('relevance_score', { ascending: false })
      .limit(maxBooks);

    if (!books || books.length === 0) {
      console.log('No books found in database');
      return new Response(JSON.stringify({
        success: true,
        content: [],
        message: 'No books found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${books.length} books, fetching content from Project Gutenberg and OpenLibrary...`);
    const bookContents = [];

    for (const book of books) {
      try {
        let fullText = '';
        let excerpt = book.description || '';
        let source = 'openlibrary';

        // Try Project Gutenberg first (best for public domain books)
        try {
          const gutenbergQuery = encodeURIComponent(`${book.title} ${book.authors.join(' ')}`);
          const gutenbergUrl = `https://gutendex.com/books/?search=${gutenbergQuery}`;
          
          console.log(`Searching Project Gutenberg: ${book.title}`);
          const gutenbergResponse = await fetch(gutenbergUrl);
          const gutenbergData = await gutenbergResponse.json();

          if (gutenbergData.results && gutenbergData.results.length > 0) {
            const gutenbergBook = gutenbergData.results[0];
            
            // Get plain text format if available
            const textFormat = gutenbergBook.formats['text/plain'] || 
                              gutenbergBook.formats['text/plain; charset=utf-8'] ||
                              gutenbergBook.formats['text/html'];
            
            if (textFormat) {
              console.log(`Found Gutenberg text for ${book.title}`);
              const textResponse = await fetch(textFormat);
              fullText = await textResponse.text();
              
              // Clean HTML if needed
              if (textFormat.includes('html')) {
                fullText = fullText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
              }
              
              // Extract relevant excerpt
              const lowerText = fullText.toLowerCase();
              const figureIndex = lowerText.indexOf(figureName.toLowerCase());
              if (figureIndex !== -1) {
                const start = Math.max(0, figureIndex - 500);
                const end = Math.min(fullText.length, figureIndex + 1500);
                excerpt = fullText.substring(start, end);
              } else {
                excerpt = fullText.substring(0, 2000);
              }
              
              source = 'gutenberg';
            }
          }
        } catch (gutenbergError) {
          console.log(`Could not fetch from Gutenberg for ${book.title}, trying OpenLibrary...`);
        }

        // If Project Gutenberg didn't work, try OpenLibrary/Internet Archive
        if (!fullText) {
          const searchQuery = encodeURIComponent(`${book.title} ${book.authors.join(' ')}`);
          const searchUrl = `https://openlibrary.org/search.json?q=${searchQuery}&limit=1`;
          
          console.log(`Searching OpenLibrary: ${book.title}`);
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();

          if (searchData.docs && searchData.docs.length > 0) {
            const olBook = searchData.docs[0];
            
            // Try to fetch full text from Internet Archive
            if (olBook.ia && olBook.ia[0]) {
              const iaUrl = `https://archive.org/metadata/${olBook.ia[0]}`;
              
              try {
                const iaResponse = await fetch(iaUrl);
                const iaData = await iaResponse.json();
                
                if (iaData.files) {
                  const textFile = iaData.files.find((f: any) => 
                    f.name?.endsWith('.txt') || f.format === 'Text'
                  );
                  
                  if (textFile) {
                    const textUrl = `https://archive.org/download/${olBook.ia[0]}/${textFile.name}`;
                    const textResponse = await fetch(textUrl);
                    fullText = await textResponse.text();
                    
                    // Extract relevant excerpt
                    const lowerText = fullText.toLowerCase();
                    const figureIndex = lowerText.indexOf(figureName.toLowerCase());
                    if (figureIndex !== -1) {
                      const start = Math.max(0, figureIndex - 500);
                      const end = Math.min(fullText.length, figureIndex + 1500);
                      excerpt = fullText.substring(start, end);
                    } else {
                      excerpt = fullText.substring(0, 2000);
                    }
                    
                    source = 'internet_archive';
                  }
                }
              } catch (iaError) {
                console.log(`Could not fetch IA content for ${book.title}:`, iaError);
              }
            }
          }
        }

        // Store in cache if we got any content
        if (excerpt) {
          const contentData = {
            book_id: book.google_books_id || book.id,
            figure_id: figureId,
            figure_name: figureName,
            book_title: book.title,
            content_excerpt: excerpt,
            full_content: fullText || null,
            source: source,
            relevance_score: book.relevance_score || 0,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          };

          const { error: insertError } = await supabase
            .from('book_content_cache')
            .insert(contentData);

          if (insertError) {
            console.error('Error caching book content:', insertError);
          }

          bookContents.push(contentData);
        }
      } catch (bookError) {
        console.error(`Error fetching content for ${book.title}:`, bookError);
      }
    }

    console.log(`Successfully fetched content for ${bookContents.length} books`);

    return new Response(JSON.stringify({
      success: true,
      content: bookContents,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Book content fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch book content';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});