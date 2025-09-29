import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Google Books Discovery function loaded");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId, forceRefresh = false } = await req.json();
    console.log('Books discovery request:', { figureName, figureId, forceRefresh });

    if (!figureName || !figureId) {
      throw new Error('Figure name and ID are required');
    }

    const GOOGLE_BOOKS_API_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY');
    if (!GOOGLE_BOOKS_API_KEY) {
      throw new Error('Google Books API key not configured');
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if we already have books for this figure (unless forcing refresh)
    if (!forceRefresh) {
      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/books?figure_id=eq.${figureId}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (existingResponse.ok) {
        const existingBooks = await existingResponse.json();
        if (existingBooks && existingBooks.length > 0) {
          console.log(`Found ${existingBooks.length} existing books for ${figureName}`);
          return new Response(JSON.stringify({
            success: true,
            books: existingBooks,
            cached: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log(`Searching Google Books for ${figureName}...`);

    // Search Google Books API
    const searchQueries = [
      `"${figureName}" biography`,
      `"${figureName}" autobiography`,
      `"${figureName}" life story`,
      `about "${figureName}"`,
      figureName
    ];

    const allBooks: any[] = [];
    const seenBooks = new Set();

    for (const query of searchQueries) {
      try {
        const booksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${GOOGLE_BOOKS_API_KEY}`;
        
        console.log(`Searching with query: "${query}"`);
        const response = await fetch(booksUrl);
        
        if (!response.ok) {
          console.error(`Google Books API error for query "${query}":`, response.status);
          continue;
        }

        const data = await response.json();
        console.log(`Found ${data.totalItems || 0} results for query: "${query}"`);

        if (data.items) {
          for (const item of data.items) {
            const bookId = item.id;
            if (seenBooks.has(bookId)) continue;
            seenBooks.add(bookId);

            const volumeInfo = item.volumeInfo || {};
            const title = volumeInfo.title || 'Unknown Title';
            const authors = volumeInfo.authors || [];
            const description = volumeInfo.description || '';
            const publishedDate = volumeInfo.publishedDate || '';
            const pageCount = volumeInfo.pageCount || 0;
            const categories = volumeInfo.categories || [];
            const imageLinks = volumeInfo.imageLinks || {};
            const previewLink = volumeInfo.previewLink || '';
            const infoLink = volumeInfo.infoLink || '';

            // Relevance scoring
            let relevanceScore = 0;
            const titleLower = title.toLowerCase();
            const descriptionLower = description.toLowerCase();
            const figureNameLower = figureName.toLowerCase();
            
            // High relevance if figure name is in title
            if (titleLower.includes(figureNameLower)) {
              relevanceScore += 50;
            }

            // Medium relevance if it's a biography/autobiography
            if (titleLower.includes('biography') || titleLower.includes('autobiography') || 
                titleLower.includes('life of') || titleLower.includes('story of')) {
              relevanceScore += 30;
            }

            // Low relevance if figure name is in description
            if (descriptionLower.includes(figureNameLower)) {
              relevanceScore += 20;
            }

            // Bonus for longer descriptions (more detailed books)
            if (description.length > 500) {
              relevanceScore += 10;
            }

            // Bonus for books with page counts (complete books)
            if (pageCount > 100) {
              relevanceScore += 15;
            }

            // Only include books with reasonable relevance
            if (relevanceScore >= 20) {
              allBooks.push({
                figure_id: figureId,
                google_books_id: bookId,
                title: title,
                authors: authors,
                description: description.substring(0, 1000), // Limit description length
                published_date: publishedDate,
                page_count: pageCount,
                categories: categories,
                thumbnail_url: imageLinks.thumbnail || imageLinks.smallThumbnail || null,
                preview_link: previewLink,
                info_link: infoLink,
                relevance_score: relevanceScore,
                search_query: query
              });
            }
          }
        }
      } catch (queryError) {
        console.error(`Error with query "${query}":`, queryError);
        continue;
      }
    }

    // Sort by relevance score and take top 20
    allBooks.sort((a, b) => b.relevance_score - a.relevance_score);
    const topBooks = allBooks.slice(0, 20);

    console.log(`Found ${topBooks.length} relevant books for ${figureName}`);

    if (topBooks.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        books: [],
        message: `No relevant books found for ${figureName}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store books in Supabase
    console.log(`Storing ${topBooks.length} books in database...`);
    
    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/books`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(topBooks)
      }
    );

    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      console.error('Failed to store books:', error);
      throw new Error(`Failed to store books: ${error}`);
    }

    const storedBooks = await insertResponse.json();
    console.log(`Successfully stored ${storedBooks.length} books for ${figureName}`);

    return new Response(JSON.stringify({
      success: true,
      books: storedBooks,
      totalFound: allBooks.length,
      stored: storedBooks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Books discovery error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to discover books';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});