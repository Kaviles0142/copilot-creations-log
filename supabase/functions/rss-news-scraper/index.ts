import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("RSS News Scraper function loaded");

// Popular news RSS feeds (completely free!)
const NEWS_FEEDS = [
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'Reuters', url: 'https://www.reutersagency.com/feed/' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Associated Press', url: 'https://feedx.net/rss/ap.xml' },
];

async function parseFeed(feedUrl: string, sourceName: string) {
  try {
    console.log(`📰 Fetching RSS feed from ${sourceName}...`);
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch ${sourceName}: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    
    // Parse XML using regex (simple approach for RSS)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 5) {
      const itemXml = match[1];
      
      // Extract title
      const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s.exec(itemXml);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
      
      // Extract description
      const descMatch = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s.exec(itemXml);
      const description = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';
      
      // Extract link
      const linkMatch = /<link>(.*?)<\/link>/s.exec(itemXml);
      const link = linkMatch ? linkMatch[1].trim() : '';
      
      // Extract date
      const dateMatch = /<pubDate>(.*?)<\/pubDate>/s.exec(itemXml);
      const date = dateMatch ? dateMatch[1].trim() : '';

      if (title && link) {
        items.push({
          title: stripHtml(title),
          snippet: stripHtml(description).substring(0, 200),
          link: link,
          source: sourceName,
          date: date,
          thumbnail: '',
          relevance_score: 0
        });
      }
    }

    console.log(`✅ Extracted ${items.length} articles from ${sourceName}`);
    return items;
  } catch (error) {
    console.error(`Error parsing ${sourceName}:`, error);
    return [];
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function calculateRelevanceScore(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  
  let score = 0;
  
  // Title matches get higher score
  if (title.includes(queryLower)) score += 10;
  
  // Count query word matches
  const queryWords = queryLower.split(' ').filter(word => word.length > 2);
  queryWords.forEach(word => {
    if (title.includes(word)) score += 3;
    if (snippet.includes(word)) score += 1;
  });
  
  return score;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query = '', num = 10 } = await req.json();
    console.log('RSS scrape request:', { query, num });

    // Fetch from all RSS feeds in parallel
    const feedPromises = NEWS_FEEDS.map(feed => 
      parseFeed(feed.url, feed.name)
    );

    const feedResults = await Promise.all(feedPromises);
    
    // Flatten all results
    let allArticles = feedResults.flat();
    
    console.log(`📊 Total articles fetched: ${allArticles.length}`);

    // If query is provided, filter and score results
    if (query && query.trim()) {
      allArticles = allArticles.map(article => ({
        ...article,
        relevance_score: calculateRelevanceScore(article, query)
      }));
      
      // Filter articles with relevance score > 0
      allArticles = allArticles.filter(a => a.relevance_score > 0);
      
      // Sort by relevance
      allArticles.sort((a, b) => b.relevance_score - a.relevance_score);
    } else {
      // If no query, just return recent articles
      allArticles = allArticles.slice(0, num);
    }

    // Limit to requested number
    const results = allArticles.slice(0, num);

    console.log(`✅ Returning ${results.length} relevant articles`);

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        provider: 'rss-feeds',
        results: results,
        total_results: results.length,
        sources: NEWS_FEEDS.map(f => f.name)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in RSS scraper:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to scrape RSS feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
