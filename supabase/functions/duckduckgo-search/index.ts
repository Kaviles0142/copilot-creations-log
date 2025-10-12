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

    // Extract search results using regex (lightweight parsing)
    const results: Array<{
      title: string;
      snippet: string;
      url: string;
      source?: string;
    }> = [];

    // Match result blocks in DuckDuckGo HTML
    const resultRegex = /<div class="result[^"]*"[\s\S]*?<\/div>(?=\s*<div class="result|<div class="footer")/g;
    const resultMatches = html.match(resultRegex) || [];
    
    console.log(`Found ${resultMatches.length} result blocks`);

    for (let i = 0; i < Math.min(resultMatches.length, limit); i++) {
      const resultHtml = resultMatches[i];
      
      // Extract title and URL
      const titleMatch = resultHtml.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      const url = titleMatch?.[1] || '';
      const titleHtml = titleMatch?.[2] || '';
      const title = titleHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      
      // Extract snippet
      const snippetMatch = resultHtml.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const snippetHtml = snippetMatch?.[1] || '';
      const snippet = snippetHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      
      // Extract source domain
      const sourceMatch = resultHtml.match(/<a[^>]*class="result__url"[^>]*>([\s\S]*?)<\/a>/);
      const sourceHtml = sourceMatch?.[1] || '';
      const source = sourceHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      if (title && url) {
        // Clean up the URL (DuckDuckGo uses redirect URLs)
        let cleanUrl = url;
        if (url.includes('//duckduckgo.com/l/?')) {
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) {
            cleanUrl = decodeURIComponent(uddgMatch[1]);
          }
        }

        results.push({
          title,
          snippet,
          url: cleanUrl,
          source
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
