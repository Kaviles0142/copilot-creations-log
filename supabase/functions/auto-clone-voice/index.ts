import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId, searchQuery } = await req.json();

    if (!figureName || !figureId) {
      throw new Error('Figure name and ID are required');
    }

    console.log(`Starting Resemble.ai voice cloning for ${figureName}...`);

    // Option B: No database check - always use fresh API searches
    console.log(`Using fresh voice search for ${figureName} (no database cache)`);

    // Check if we have required API keys
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    
    // Search for authentic recordings on YouTube
    let audioUrl = null;
    let videoTitle = '';
    
    if (YOUTUBE_API_KEY) {
      try {
        console.log(`Searching YouTube for: "${searchQuery || figureName + ' original speech recording authentic voice'}"`);
        
        const query = searchQuery || `${figureName} original speech recording authentic voice`;
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoDuration=medium&order=relevance&maxResults=5&key=${YOUTUBE_API_KEY}`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.items && searchData.items.length > 0) {
          // Enhanced filtering for authentic audio
          const bestVideo = searchData.items.find((item: any) => {
            const title = item.snippet.title.toLowerCase();
            const description = item.snippet.description.toLowerCase();
            const channelTitle = item.snippet.channelTitle.toLowerCase();
            
            // Prioritize official sources and authentic recordings
            const isAuthentic = (
              (title.includes('original') || title.includes('authentic') || 
               title.includes('real') || title.includes('voice') ||
               title.includes('speech') || title.includes('interview') ||
               title.includes('address') || title.includes('recording')) &&
              !title.includes('ai') && !title.includes('fake') && 
              !title.includes('generated') && !title.includes('impression') &&
              !title.includes('reaction') && !title.includes('parody')
            );
            
            const isOfficialSource = (
              channelTitle.includes('archive') || 
              channelTitle.includes('museum') ||
              channelTitle.includes('library') ||
              channelTitle.includes('documentary') ||
              channelTitle.includes('history')
            );
            
            return isAuthentic || isOfficialSource;
          }) || searchData.items[0];
          
          videoTitle = bestVideo.snippet.title;
          audioUrl = `https://www.youtube.com/watch?v=${bestVideo.id.videoId}`;
          console.log(`Selected video for cloning: "${videoTitle}"`);
        }
      } catch (error) {
        console.error('YouTube search failed:', error);
      }
    }

    // Create Resemble.ai voice clone
    console.log(`Creating Resemble.ai voice clone for ${figureName}...`);
    
    try {
      const resembleResponse = await fetch(`https://trclpvryrjlafacocbnd.supabase.co/functions/v1/resemble-voice-clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          figureName: figureName,
          figureId: figureId,
          audioUrl: audioUrl
        })
      });

      if (resembleResponse.ok) {
        const resembleData = await resembleResponse.json();
        if (resembleData.success) {
          console.log(`Successfully created Resemble.ai voice: ${resembleData.voice_name}`);
          
          return new Response(JSON.stringify({
            success: true,
            voice_id: resembleData.voice_id,
            voice_name: resembleData.voice_name,
            source: audioUrl || 'Resemble.ai premium voice',
            message: audioUrl 
              ? `🎤 Successfully cloned authentic voice for ${figureName} using Resemble.ai!`
              : `🎤 Created premium Resemble.ai voice for ${figureName}!`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      const errorText = await resembleResponse.text();
      console.error('Resemble.ai cloning failed:', errorText);
      
      // Option B: No fallback storage in database - return error
      return new Response(JSON.stringify({
        success: false,
        error: `Voice cloning failed: ${errorText}`,
        voice_id: null,
        voice_name: null
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (resembleError) {
      console.error('Resemble.ai pipeline error:', resembleError);
      
      // Return error - no other fallbacks
      return new Response(JSON.stringify({
        success: false,
        error: `Voice cloning failed: ${resembleError instanceof Error ? resembleError.message : 'Unknown error'}`,
        voice_id: null,
        voice_name: null
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Voice cloning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Voice cloning failed';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});