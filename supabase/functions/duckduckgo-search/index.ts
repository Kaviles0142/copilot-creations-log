import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

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
    const { query, limit = 10 } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    console.log(`Searching DuckDuckGo for: "${query}"`);

    // Use DuckDuckGo HTML version (no JavaScript required)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML response');
    }

    // Extract search results from HTML
    const results: Array<{
      title: string;
      snippet: string;
      url: string;
      source?: string;
    }> = [];

    // DuckDuckGo HTML uses specific classes for results
    const resultElements = doc.querySelectorAll('.result');
    
    console.log(`Found ${resultElements.length} result elements`);

    for (let i = 0; i < Math.min(resultElements.length, limit); i++) {
      const element = resultElements[i];
      
      // Extract title and URL
      const titleLink = element.querySelector('.result__a');
      const title = titleLink?.textContent?.trim() || '';
      const url = titleLink?.getAttribute('href') || '';
      
      // Extract snippet
      const snippetElement = element.querySelector('.result__snippet');
      const snippet = snippetElement?.textContent?.trim() || '';
      
      // Extract source domain
      const sourceElement = element.querySelector('.result__url');
      const source = sourceElement?.textContent?.trim() || '';

      if (title && url) {
        // Clean up the URL (DuckDuckGo sometimes adds tracking parameters)
        const cleanUrl = url.startsWith('//duckduckgo.com/l/?') 
          ? decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url)
          : url;

        results.push({
          title: title.replace(/\s+/g, ' ').trim(),
          snippet: snippet.replace(/\s+/g, ' ').trim(),
          url: cleanUrl,
          source: source
        });
      }
    }

    console.log(`Extracted ${results.length} search results from DuckDuckGo`);

    if (results.length === 0) {
      console.log(`No results found for: "${query}"`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: [],
          message: 'No results found for this query'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        total: results.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching DuckDuckGo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: true,
        data: [],
        error: errorMessage 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
