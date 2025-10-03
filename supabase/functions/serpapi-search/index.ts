import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Multi-provider Search function loaded (Google Custom Search + SerpApi fallback)");

// Helper function to search using Google Custom Search
async function searchWithGoogleCustomSearch(query: string, type: string, num: number) {
  const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
  const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
  
  if (!apiKey || !searchEngineId) {
    console.log('Google Custom Search credentials not available');
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: query.trim(),
      num: Math.min(num, 10).toString(), // Google Custom Search max is 10
    });

    if (type === 'news') {
      params.set('sort', 'date');
      params.set('dateRestrict', 'd7'); // Last week for news
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    console.log('Trying Google Custom Search...');
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google Custom Search failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('Google Custom Search returned no results');
      return [];
    }

    const processedResults = data.items.map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      link: item.link || '',
      source: extractDomain(item.link || ''),
      date: item.pagemap?.metatags?.[0]?.['article:published_time'] || '',
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || '',
      relevance_score: calculateRelevanceScore(item, query)
    }));

    processedResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
    console.log(`Google Custom Search: Found ${processedResults.length} results`);
    
    return processedResults;
  } catch (error) {
    console.error('Google Custom Search error:', error);
    return null;
  }
}

// Helper function to search using Bing as fallback
async function searchWithBing(query: string, type: string, num: number) {
  const apiKey = Deno.env.get('AZURE_BING_SEARCH_API_KEY');
  
  if (!apiKey) {
    console.log('Bing API key not available');
    return null;
  }

  try {
    const endpoint = type === 'news' 
      ? 'https://api.bing.microsoft.com/v7.0/news/search'
      : 'https://api.bing.microsoft.com/v7.0/search';
    
    const params = new URLSearchParams({
      q: query.trim(),
      count: num.toString(),
      mkt: 'en-US'
    });

    if (type === 'news') {
      params.set('freshness', 'Week');
    }

    const searchUrl = `${endpoint}?${params.toString()}`;
    console.log('Trying Bing fallback...');

    const response = await fetch(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    if (!response.ok) {
      console.error('Bing request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    let processedResults = [];
    
    if (type === 'news' && data.value) {
      processedResults = data.value.slice(0, num).map((item: any) => ({
        title: item.name || '',
        snippet: item.description || '',
        link: item.url || '',
        source: item.provider?.[0]?.name || extractDomain(item.url || ''),
        date: item.datePublished || '',
        thumbnail: item.image?.thumbnail?.contentUrl || '',
        relevance_score: calculateRelevanceScore({ title: item.name, snippet: item.description }, query)
      }));
    } else if (data.webPages?.value) {
      processedResults = data.webPages.value.slice(0, num).map((item: any) => ({
        title: item.name || '',
        snippet: item.snippet || '',
        link: item.url || '',
        source: extractDomain(item.url || ''),
        relevance_score: calculateRelevanceScore({ title: item.name, snippet: item.snippet }, query)
      }));
    }

    processedResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
    console.log(`Bing: Found ${processedResults.length} results`);
    
    return processedResults;
  } catch (error) {
    console.error('Bing error:', error);
    return null;
  }
}

// Helper function to search using SerpApi as fallback
async function searchWithSerpApi(query: string, type: string, location: string, num: number) {
  const apiKey = Deno.env.get('SERPAPI_API_KEY');
  
  if (!apiKey) {
    console.log('SerpApi API key not available');
    return null;
  }

  try {
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
      params.set('gl', 'us');
      params.set('hl', 'en');
    }

    searchUrl += '?' + params.toString();
    console.log('Trying SerpApi fallback...');

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('SerpApi request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
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

    processedResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
    console.log(`SerpApi: Found ${processedResults.length} results`);
    
    return processedResults;
  } catch (error) {
    console.error('SerpApi error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = "news", location = "United States", num = 10 } = await req.json();
    console.log('Search request:', { query, type, location, num });

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

    // Try Google Custom Search first
    let results = await searchWithGoogleCustomSearch(query, type, num);
    let provider = 'google-custom-search';
    
    // If Google Custom Search fails, fallback to Bing
    if (results === null) {
      console.log('Falling back to Bing...');
      results = await searchWithBing(query, type, num);
      provider = 'bing';
    }
    
    // If Bing fails, fallback to SerpApi
    if (results === null) {
      console.log('Falling back to SerpApi...');
      results = await searchWithSerpApi(query, type, location, num);
      provider = 'serpapi';
    }
    
    // If all fail, return error
    if (results === null) {
      console.error('All search providers failed');
      return new Response(
        JSON.stringify({ 
          error: 'All search providers unavailable',
          details: 'Please check API keys and quotas'
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully retrieved ${results.length} results using ${provider}`);

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        type: type,
        provider: provider,
        results: results,
        total_results: results.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in search function:', error);
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