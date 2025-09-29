import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("SerpApi Search function loaded");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = "news", location = "United States", num = 10 } = await req.json();
    console.log('SerpApi search request:', { query, type, location, num });

    if (!query || query.trim() === '') {
      console.error('Missing or empty query parameter');
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = Deno.env.get('SERPAPI_API_KEY');
    if (!apiKey) {
      console.error('SERPAPI_API_KEY environment variable not set');
      return new Response(
        JSON.stringify({ error: 'SerpApi API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build SerpApi URL based on search type
    let searchUrl = 'https://serpapi.com/search';
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query.trim(),
      location: location,
      num: num.toString(),
    });

    if (type === 'news') {
      params.set('engine', 'google_news');
      params.set('gl', 'us');
      params.set('hl', 'en');
    } else {
      params.set('engine', 'google');
    }

    searchUrl += '?' + params.toString();
    console.log('Making request to SerpApi:', searchUrl.replace(apiKey, '[REDACTED]'));

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('SerpApi request failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `SerpApi request failed: ${response.statusText}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('SerpApi response received, processing results...');

    // Process results based on search type
    let processedResults = [];
    
    if (type === 'news' && data.news_results) {
      processedResults = data.news_results.slice(0, num).map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        link: item.link || '',
        source: item.source || '',
        date: item.date || '',
        thumbnail: item.thumbnail || '',
        relevance_score: calculateRelevanceScore(item, query)
      }));
    } else if (data.organic_results) {
      processedResults = data.organic_results.slice(0, num).map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        link: item.link || '',
        source: extractDomain(item.link || ''),
        relevance_score: calculateRelevanceScore(item, query)
      }));
    }

    // Sort by relevance
    processedResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);

    console.log(`Processed ${processedResults.length} search results`);

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        type: type,
        results: processedResults,
        total_results: processedResults.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in SerpApi search function:', error);
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

function calculateRelevanceScore(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  
  let score = 0;
  
  // Title matches get higher score
  if (title.includes(queryLower)) score += 10;
  
  // Count query word matches in title and snippet
  const queryWords = queryLower.split(' ').filter(word => word.length > 2);
  queryWords.forEach(word => {
    if (title.includes(word)) score += 3;
    if (snippet.includes(word)) score += 1;
  });
  
  return score;
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Unknown Source';
  }
}