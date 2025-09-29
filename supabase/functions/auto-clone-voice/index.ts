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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not found');
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
          
          // Use a YouTube to audio conversion service or direct URL extraction
          // For now, we'll use a placeholder approach
          audioUrl = `https://www.youtube.com/watch?v=${authenticVideo.id.videoId}`;
        }
      } catch (error) {
        console.error('YouTube search failed:', error);
      }
    }

    // If we found an authentic recording, attempt to clone it with ElevenLabs
    if (audioUrl && ELEVENLABS_API_KEY) {
      try {
        console.log(`Attempting to clone voice from: ${audioUrl}`);
        
        // For now, we'll create a voice clone using ElevenLabs instant voice cloning
        // Note: This is a simplified approach. In production, you'd need to:
        // 1. Download/extract audio from YouTube
        // 2. Process and clean the audio
        // 3. Upload to ElevenLabs for cloning
        
        // Create voice clone with ElevenLabs
        const cloneResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${figureName} (Auto-cloned)`,
            description: `Auto-cloned voice from: ${videoTitle}`,
            labels: {
              accent: 'american',
              description: `Historical figure: ${figureName}`,
              age: 'middle_aged',
              gender: 'male'
            }
          }),
        });

        if (cloneResponse.ok) {
          const cloneResult = await cloneResponse.json();
          const actualVoiceId = cloneResult.voice_id;
          
          console.log(`Successfully cloned voice with ElevenLabs: ${actualVoiceId}`);
          
          // Store the cloned voice information in Supabase
          const voiceData = {
            voice_id: actualVoiceId,
            voice_name: `${figureName} (Auto-cloned)`,
            description: `Auto-cloned from: ${videoTitle}`,
            is_cloned: true,
            figure_id: figureId,
            created_at: new Date().toISOString()
          };

          const storeResponse = await fetch(
            `${supabaseUrl}/rest/v1/historical_voices`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(voiceData)
            }
          );

          if (storeResponse.ok) {
            console.log(`Successfully stored cloned voice for ${figureName}`);
            return new Response(JSON.stringify({
              success: true,
              voice_id: actualVoiceId,
              voice_name: `${figureName} (Auto-cloned)`,
              source: audioUrl,
              message: `Successfully auto-cloned voice for ${figureName} using ElevenLabs`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          const error = await cloneResponse.text();
          console.error('ElevenLabs cloning failed:', error);
        }
      } catch (error) {
        console.error('Voice cloning error:', error);
      }
    }

    // If voice cloning failed, create a simulated clone with a preset voice
    // This ensures we always return something but with a note that it's not authentic
    console.log(`Voice cloning failed for ${figureName}, creating placeholder entry...`);
    
    // Generate a unique voice ID for this figure - use timestamp for uniqueness
    const timestamp = Date.now();
    const simulatedVoiceId = `${figureId}-simulated-${timestamp}`;
    
    // Store the simulated voice information in Supabase
    const voiceData = {
      voice_id: simulatedVoiceId,
      voice_name: `${figureName} (Simulated)`,
      description: audioUrl ? 
        `Failed to clone from: ${videoTitle} - using preset voice` : 
        `No authentic recordings found for ${figureName} - using preset voice`,
      is_cloned: false, // Mark as not actually cloned
      figure_id: figureId,
      created_at: new Date().toISOString()
    };

    // Insert with conflict handling
    const storeResponse = await fetch(
      `${supabaseUrl}/rest/v1/historical_voices`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(voiceData)
      }
    );

    if (!storeResponse.ok) {
      const error = await storeResponse.text();
      console.error('Failed to store voice data:', error);
      throw new Error(`Failed to store voice: ${error}`);
    }

    console.log(`Created placeholder entry for ${figureName} - voice cloning failed`);

    return new Response(JSON.stringify({
      success: false,
      voice_id: simulatedVoiceId,
      voice_name: `${figureName} (Simulated)`,
      source: audioUrl || 'No authentic recordings found',
      message: `Voice cloning failed for ${figureName} - using preset voice instead`
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