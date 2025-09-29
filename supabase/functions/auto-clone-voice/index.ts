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
    const { figureName, figureId, searchQuery } = await req.json();

    if (!figureName || !figureId) {
      throw new Error('Figure name and ID are required');
    }

    console.log(`Auto-cloning voice for ${figureName}...`);

    // Check API keys
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      console.log('ElevenLabs API key not found - using preset voices');
    }

    // Search for authentic recordings on YouTube
    let audioUrl = null;
    let videoTitle = '';
    
    if (YOUTUBE_API_KEY) {
      try {
        console.log(`Searching YouTube for: "${searchQuery}"`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoDuration=medium&order=relevance&maxResults=5&key=${YOUTUBE_API_KEY}`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.items && searchData.items.length > 0) {
          // Look for videos that likely contain original speech
          const authenticVideo = searchData.items.find((item: any) => {
            const title = item.snippet.title.toLowerCase();
            const description = item.snippet.description.toLowerCase();
            
            return (
              (title.includes('original') || title.includes('authentic') || 
               title.includes('real') || title.includes('voice') ||
               title.includes('speech') || title.includes('interview')) &&
              !title.includes('ai') && !title.includes('fake') && 
              !title.includes('generated') && !title.includes('impression')
            );
          }) || searchData.items[0];
          
          videoTitle = authenticVideo.snippet.title;
          console.log(`Found potential authentic recording: "${videoTitle}"`);
          audioUrl = `https://www.youtube.com/watch?v=${authenticVideo.id.videoId}`;
        }
      } catch (error) {
        console.error('YouTube search failed:', error);
      }
    }

    // For now, voice cloning is not fully implemented
    // We'll return success with a preset voice ID that the frontend can use
    console.log(`Voice cloning not yet available for ${figureName}, using preset voice...`);
    
    // Use a preset voice ID that matches the figure
    const presetVoiceMap: Record<string, string> = {
      'john-f-kennedy': 'Daniel',
      'jfk': 'Daniel',
      'albert-einstein': 'Einstein', 
      'winston-churchill': 'George',
      'abraham-lincoln': 'Will',
      'napoleon': 'George',
      'shakespeare': 'Callum',
      'marie-curie': 'Sarah',
      'cleopatra': 'Charlotte',
      'joan-of-arc': 'Jessica'
    };
    
    const presetVoiceId = presetVoiceMap[figureId] || (figureId.includes('marie') || figureId.includes('cleopatra') || figureId.includes('joan') ? 'Sarah' : 'Einstein');
    
    console.log(`Using preset voice "${presetVoiceId}" for ${figureName}`);

    return new Response(JSON.stringify({
      success: true,
      voice_id: presetVoiceId,
      voice_name: `${figureName} (Preset Voice)`,
      source: audioUrl || 'Preset voice - cloning not yet available',
      message: `Using preset voice for ${figureName} - authentic cloning will be available in future updates`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Auto voice cloning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Auto voice cloning failed';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});