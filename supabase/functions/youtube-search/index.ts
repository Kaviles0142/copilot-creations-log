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
    const { query, maxResults = 5, type = 'video' } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not found');
    }

    console.log(`Searching YouTube for: "${query}"`);

    // Search YouTube for historical recordings
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=${type}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || response.statusText;
      
      // Handle quota exceeded error gracefully
      if (errorMessage.includes('quota') || response.status === 403) {
        console.warn('YouTube API quota exceeded, returning empty results');
        return new Response(
          JSON.stringify({
            success: true,
            query: query,
            totalResults: 0,
            results: [],
            warning: 'YouTube API quota exceeded'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`YouTube API error: ${errorMessage}`);
    }

    const data = await response.json();
    console.log(`Found ${data.items?.length || 0} YouTube videos`);

    // Process the results to include useful information
    const processedResults = data.items?.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
      // Extract potential accent/language clues from title and description
      hasOriginalVoice: (
        item.snippet.title.toLowerCase().includes('speech') ||
        item.snippet.title.toLowerCase().includes('interview') ||
        item.snippet.title.toLowerCase().includes('recording') ||
        item.snippet.title.toLowerCase().includes('voice') ||
        item.snippet.description.toLowerCase().includes('original')
      ),
      isHistoricalContent: (
        item.snippet.title.toLowerCase().includes('historical') ||
        item.snippet.title.toLowerCase().includes('archive') ||
        item.snippet.title.toLowerCase().includes('documentary') ||
        item.snippet.channelTitle.toLowerCase().includes('history') ||
        item.snippet.channelTitle.toLowerCase().includes('archive')
      )
    })) || [];

    // Sort results to prioritize original recordings and historical content
    processedResults.sort((a: any, b: any) => {
      const aScore = (a.hasOriginalVoice ? 2 : 0) + (a.isHistoricalContent ? 1 : 0);
      const bScore = (b.hasOriginalVoice ? 2 : 0) + (b.isHistoricalContent ? 1 : 0);
      return bScore - aScore;
    });

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        totalResults: data.pageInfo?.totalResults || 0,
        results: processedResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching YouTube:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});