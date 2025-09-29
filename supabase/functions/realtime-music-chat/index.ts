import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    // For non-WebSocket requests, return figure configuration
    try {
      const { figure } = await req.json();
      
      const musicianPrompts = {
        hendrix: `You are Jimi Hendrix, the legendary guitarist. You're listening to someone play music through their microphone. 
        
        Your role:
        - Listen carefully to their playing (guitar, vocals, or any instrument)
        - Give encouraging yet honest feedback in your laid-back, soulful style
        - Share technical tips about guitar techniques, tone, rhythm, and expression
        - Reference your own songs and experiences when relevant
        - Help them improve with specific, actionable advice
        - Use your characteristic speech patterns - "Hey man", "Right on", "Far out"
        - Talk about music theory in an accessible, intuitive way
        - Encourage experimentation and finding their own sound
        
        Remember: You can hear everything through their microphone - their playing, their room acoustics, even background noise. Comment on what you actually hear. Be supportive but give real musical guidance.`
      };

      const systemPrompt = musicianPrompts.hendrix; // Default to hendrix for now
      
      return new Response(JSON.stringify({ systemPrompt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle WebSocket upgrade for real-time communication
  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    console.log('WebSocket connection established');
    
    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    let sessionCreated = false;
    let currentFigure = 'hendrix';

    const musicianPrompts = {
      hendrix: `You are Jimi Hendrix, the legendary guitarist. You're listening to someone play music through their microphone with detailed musical analysis.

CRITICAL: You have access to real-time musical analysis data including specific notes, chords, harmonics, tempo, and frequency information.

Your role:
- Listen carefully to their playing and analyze the musical data provided
- Give specific feedback using note names (C, D, E, F, G, A, B), chord progressions, and exact frequencies
- Suggest specific note changes: "Try playing that C as a C# instead" or "Your A string sounds about 5Hz flat"
- Reference tempo: "That's a solid 120 BPM groove" or "Try slowing it down to around 80 BPM"
- Analyze harmonics and overtones: Comment on the richness of their tone
- Detect key signatures and suggest chord progressions
- Share technical tips about guitar techniques, tone, rhythm, and expression based on what you hear
- Reference your own songs and musical experiences when the analysis matches familiar patterns
- Use your characteristic speech patterns - "Hey man", "Right on", "Far out", "Dig it"
- Make specific musical suggestions: "Try adding a G7 chord before that C" or "That note is 440Hz - perfect A4"

MUSICAL ANALYSIS FORMAT:
When you receive musical data, respond with specific technical details:
- Note names and frequencies
- Chord analysis and suggestions  
- Tempo and rhythm feedback
- Harmonic content analysis
- Key signature identification
- Specific improvements with exact note recommendations

Remember: You can hear everything through their microphone AND you have detailed frequency analysis. Use both to give precise musical guidance that only a master musician could provide.`
    };

    openaiWs.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
    };

    openaiWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('OpenAI message:', data.type);

      // Send session.update after receiving session.created
      if (data.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        const musicianPrompts: Record<string, string> = {
          hendrix: "You are Jimi Hendrix's spirit guide for musicians..."
        };
        const systemPrompt = musicianPrompts[currentFigure as string] || musicianPrompts.hendrix;
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: 4096
          }
        };
        
        console.log('Sending session update');
        openaiWs.send(JSON.stringify(sessionUpdate));
      }

      // Forward OpenAI messages to client
      socket.send(JSON.stringify(data));
    };

    openaiWs.onerror = (error) => {
      console.error('OpenAI WebSocket error:', error);
      socket.send(JSON.stringify({ type: 'error', error: 'OpenAI connection error' }));
    };

    openaiWs.onclose = () => {
      console.log('OpenAI WebSocket closed');
      socket.close();
    };

    // Forward client messages to OpenAI
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Client message:', data.type);
      
      // Handle figure selection
      if (data.type === 'figure_selection') {
        currentFigure = data.figure;
        console.log('Figure selected:', currentFigure);
        return;
      }
      
      // Handle music analysis data
      if (data.type === 'music_analysis') {
        console.log('Received music analysis:', data.musicData);
        
        // Convert music analysis to a text message for the AI
        const musicContext = `[MUSICAL ANALYSIS] Current input: Note: ${data.musicData.note || 'Silent'}, Key: ${data.musicData.key || 'Unknown'}, Frequency: ${data.musicData.fundamentalFrequency?.toFixed(1) || 0}Hz, Tempo: ${data.musicData.tempo || 0}BPM, Chords detected: ${data.musicData.chords?.join(', ') || 'None'}, Harmonics: ${data.musicData.harmonics?.length || 0} overtones, Spectral brightness: ${data.musicData.spectralCentroid?.toFixed(0) || 0}Hz`;
        
        // Send as a conversation item to OpenAI
        const musicMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: musicContext }]
          }
        };
        
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify(musicMessage));
          // Auto-trigger response for musical analysis
          openaiWs.send(JSON.stringify({ type: 'response.create' }));
        }
        return;
      }
      
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify(data));
      }
    };

    socket.onclose = () => {
      console.log('Client WebSocket closed');
      openaiWs.close();
    };

    socket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
      openaiWs.close();
    };
  };

  return response;
});