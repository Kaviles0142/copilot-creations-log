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

    // Use Wikipedia's MediaWiki API for search - more reliable than REST API
    const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=${limit}`;
    
    console.log(`Making request to: ${searchApiUrl}`);
    
    const searchResponse = await fetch(searchApiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`Search response status: ${searchResponse.status}`);

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`Search results count: ${searchData?.query?.search?.length || 0}`);
      
      if (searchData?.query?.search?.length > 0) {
        const firstResult = searchData.query.search[0];
        const pageTitle = firstResult.title;
        console.log(`Best match: ${pageTitle}`);
        
        // Get detailed summary for the best match
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        
        const summaryResponse = await fetch(summaryUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          console.log(`Found Wikipedia article: ${summaryData.title}`);
          
          // Build search results
          const searchResults = searchData.query.search.map((result: any) => ({
            title: result.title,
            snippet: result.snippet?.replace(/<[^>]*>/g, '') || '',
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`
          }));
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                title: summaryData.title,
                extract: summaryData.extract,
                url: summaryData.content_urls?.desktop?.page,
                thumbnail: summaryData.thumbnail?.source,
                description: summaryData.description
              },
              searchResults: searchResults
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          console.log(`Summary fetch failed: ${summaryResponse.status}`);
        }
      }
    } else {
      const errorText = await searchResponse.text();
      console.log(`Search API error: ${errorText}`);
    }

    // Fallback to direct page lookup if MediaWiki search doesn't work
    console.log(`Trying direct page lookup as fallback...`);
    const fallbackUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const fallbackResponse = await fetch(fallbackUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!fallbackResponse.ok) {
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

    const data = await fallbackResponse.json();
    console.log(`Found Wikipedia article via fallback: ${data.title}`);

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