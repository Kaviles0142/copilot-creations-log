import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 5 } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    console.log(`Searching Wikipedia for: "${query}"`);

    // Search Wikipedia
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      // If direct page lookup fails, try search API
      const fallbackUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&origin=*`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
          'Accept': 'application/json'
        }
      });

      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.query?.search?.length > 0) {
        // Get detailed info for the first result
        const firstResult = fallbackData.query.search[0];
        const detailUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`;
        
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
            'Accept': 'application/json'
          }
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          console.log(`Found Wikipedia article: ${detailData.title}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                title: detailData.title,
                extract: detailData.extract,
                url: detailData.content_urls?.desktop?.page,
                thumbnail: detailData.thumbnail?.source,
                description: detailData.description
              },
              searchResults: fallbackData.query.search.slice(0, limit).map((result: any) => ({
                title: result.title,
                snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`
              }))
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // No results found - return success with empty data instead of error
      console.log(`No Wikipedia articles found for: "${query}"`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: null,
          message: 'No Wikipedia articles found for this query'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await searchResponse.json();
    console.log(`Found Wikipedia article: ${data.title}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: data.title,
          extract: data.extract,
          url: data.content_urls?.desktop?.page,
          thumbnail: data.thumbnail?.source,
          description: data.description
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching Wikipedia:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: true,  // Changed to true to avoid breaking the UI
        data: null,
        error: errorMessage 
      }),
      {
        status: 200,  // Changed to 200 to avoid throwing errors in UI
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});