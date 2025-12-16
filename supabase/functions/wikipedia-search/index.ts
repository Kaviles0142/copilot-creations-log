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

    // First, try using Wikipedia's opensearch API which has better fuzzy matching and suggestions
    const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(query)}&limit=${limit}&origin=*`;
    
    console.log(`[DEBUG] OpenSearch URL: ${opensearchUrl}`);
    
    const opensearchResponse = await fetch(opensearchUrl, {
      headers: {
        'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
        'Accept': 'application/json'
      }
    });

    console.log(`[DEBUG] OpenSearch response status: ${opensearchResponse.status}`);
    
    if (opensearchResponse.ok) {
      const opensearchText = await opensearchResponse.text();
      console.log(`[DEBUG] OpenSearch raw response (first 500 chars): ${opensearchText.substring(0, 500)}`);
      
      let opensearchData;
      try {
        opensearchData = JSON.parse(opensearchText);
      } catch (parseError) {
        console.error(`[DEBUG] OpenSearch JSON parse error: ${parseError}`);
        // Continue to fallback
      }
      
      if (opensearchData && opensearchData[1]?.length > 0) {
        const firstTitle = opensearchData[1][0];
        console.log(`OpenSearch suggested: ${firstTitle}`);
        
        // Get detailed info for the best match
        const detailUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
        console.log(`[DEBUG] Detail URL: ${detailUrl}`);
        
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
            'Accept': 'application/json'
          }
        });

        console.log(`[DEBUG] Detail response status: ${detailResponse.status}`);

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          console.log(`Found Wikipedia article: ${detailData.title}`);
          
          // Build search results from opensearch data
          const searchResults = opensearchData[1].map((title: string, index: number) => ({
            title: title,
            snippet: opensearchData[2][index] || '',
            url: opensearchData[3][index] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
          }));
          
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
              searchResults: searchResults
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          const detailErrorText = await detailResponse.text();
          console.error(`[DEBUG] Detail API failed: ${detailResponse.status} - ${detailErrorText.substring(0, 300)}`);
        }
      } else {
        console.log(`[DEBUG] OpenSearch returned no results. Data structure: ${JSON.stringify(opensearchData)}`);
      }
    } else {
      const errorText = await opensearchResponse.text();
      console.error(`[DEBUG] OpenSearch API failed: ${opensearchResponse.status} - ${errorText.substring(0, 300)}`);
    }

    // Fallback to direct page lookup if opensearch doesn't work
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'HistoricalChat/1.0 (contact@example.com)',
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {

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