import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Google Books Discovery function loaded");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId, forceRefresh = false } = await req.json();
    console.log('Books discovery request:', { figureName, figureId, forceRefresh });

    if (!figureName || !figureId) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'figureName and figureId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have books for this figure (unless forcing refresh)
    if (!forceRefresh) {
      const { data: existingBooks, error: fetchError } = await supabase
        .from('books')
        .select('*')
        .eq('figure_id', figureId);

      if (!fetchError && existingBooks && existingBooks.length > 0) {
        console.log(`Found ${existingBooks.length} existing books for ${figureName}`);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            books: existingBooks,
            totalBooks: existingBooks.length
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    const apiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_BOOKS_API_KEY environment variable not set');
      return new Response(
        JSON.stringify({ error: 'Google Books API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Discovering books for:', figureName);
    
    // Search for different types of books
    const searchQueries = [
      `inauthor:"${figureName}"`, // Books by the figure
      `intitle:"${figureName}" OR subject:"${figureName}"`, // Books about the figure
      `"${figureName}" biography`, // Biographies
      `"${figureName}" works`, // Collected works
      `"${figureName}" letters OR correspondence`, // Letters/correspondence
    ];

    const allBooks = [];
    const seenBooks = new Set();

    for (const query of searchQueries) {
      try {
        console.log('Searching with query:', query);
        
        const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40&key=${apiKey}`;
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          console.error('Google Books API request failed:', response.status, response.statusText);
          continue;
        }

        const data = await response.json();
        
        if (data.items) {
          for (const item of data.items) {
            const volumeInfo = item.volumeInfo;
            const bookId = item.id;
            
            // Skip if we've already seen this book
            if (seenBooks.has(bookId)) continue;
            seenBooks.add(bookId);

            // Skip if no title or authors
            if (!volumeInfo.title || !volumeInfo.authors) continue;

            // Determine book type based on authors and content
            let bookType = 'related';
            const authors = volumeInfo.authors || [];
            const title = volumeInfo.title.toLowerCase();
            const description = (volumeInfo.description || '').toLowerCase();
            
            if (authors.some(author => 
              author.toLowerCase().includes(figureName.toLowerCase()) ||
              figureName.toLowerCase().includes(author.toLowerCase())
            )) {
              bookType = 'by_figure';
            } else if (
              title.includes(figureName.toLowerCase()) ||
              description.includes(figureName.toLowerCase()) ||
              title.includes('biography') ||
              title.includes('life of') ||
              description.includes('biography')
            ) {
              bookType = 'about_figure';
            }

            // Extract ISBNs
            let isbn10 = null;
            let isbn13 = null;
            if (volumeInfo.industryIdentifiers) {
              for (const identifier of volumeInfo.industryIdentifiers) {
                if (identifier.type === 'ISBN_10') isbn10 = identifier.identifier;
                if (identifier.type === 'ISBN_13') isbn13 = identifier.identifier;
              }
            }

            const book = {
              figure_id: figureId,
              figure_name: figureName,
              title: volumeInfo.title,
              authors: authors,
              description: volumeInfo.description || null,
              published_date: volumeInfo.publishedDate || null,
              page_count: volumeInfo.pageCount || null,
              categories: volumeInfo.categories || [],
              thumbnail_url: volumeInfo.imageLinks?.thumbnail || null,
              preview_link: volumeInfo.previewLink || null,
              info_link: volumeInfo.infoLink || null,
              book_type: bookType,
              google_books_id: bookId,
              isbn_10: isbn10,
              isbn_13: isbn13,
              language: volumeInfo.language || 'en'
            };

            allBooks.push(book);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('Error in search query:', query, error);
        continue;
      }
    }

    console.log(`Found ${allBooks.length} total books for ${figureName}`);

    // Sort books by relevance (by figure first, then about figure, then related)
    allBooks.sort((a, b) => {
      const typeOrder = { 'by_figure': 0, 'about_figure': 1, 'related': 2 };
      return typeOrder[a.book_type] - typeOrder[b.book_type];
    });

    // Store books in database
    if (allBooks.length > 0) {
      // Clear existing books if force refresh
      if (forceRefresh) {
        await supabase
          .from('books')
          .delete()
          .eq('figure_id', figureId);
      }

      const { error: insertError } = await supabase
        .from('books')
        .insert(allBooks);

      if (insertError) {
        console.error('Error inserting books:', insertError);
        // Continue anyway, return the found books
      } else {
        console.log(`Successfully stored ${allBooks.length} books in database`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        books: allBooks,
        totalBooks: allBooks.length,
        breakdown: {
          by_figure: allBooks.filter(b => b.book_type === 'by_figure').length,
          about_figure: allBooks.filter(b => b.book_type === 'about_figure').length,
          related: allBooks.filter(b => b.book_type === 'related').length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in Google Books discovery function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});