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

      const systemPrompt = musicianPrompts[figure] || musicianPrompts.hendrix;
      
      return new Response(JSON.stringify({ systemPrompt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
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

    openaiWs.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
    };

    openaiWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('OpenAI message:', data.type);

      // Send session.update after receiving session.created
      if (data.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        const systemPrompt = musicianPrompts[currentFigure] || musicianPrompts.hendrix;
        
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