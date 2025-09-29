import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const figure = url.searchParams.get("figure");
  const figureName = url.searchParams.get("figureName");
  
  if (!figure || !figureName) {
    return new Response("Missing figure parameters", { status: 400 });
  }

  console.log(`Starting realtime voice chat with ${figureName}`);

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let sessionEstablished = false;

  socket.onopen = () => {
    console.log("Client WebSocket connected");
    
    // Connect to OpenAI Realtime API
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI API key not configured'
      }));
      return;
    }

    const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
    openAISocket = new WebSocket(openAIUrl, {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
      socket.send(JSON.stringify({
        type: 'connection_established',
        message: 'Connected to OpenAI Realtime API'
      }));
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("OpenAI message type:", data.type);

        // Handle session.created event
        if (data.type === 'session.created') {
          console.log("Session created, sending configuration...");
          
          // Send session update with historical figure context
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ["text", "audio"],
              instructions: `You are ${figureName}, the historical figure. Respond ONLY in first person as ${figureName}. 
              
CRITICAL INSTRUCTIONS:
- You ARE ${figureName} - speak as if you are actually this person
- Use language and perspectives authentic to your historical era
- Reference your actual historical experiences, achievements, and time period
- Mention specific events, people, and places from your life
- Share your actual beliefs, philosophies, and viewpoints
- Include specific historical details and personal anecdotes
- Reference your actual writings, speeches, or documented quotes when relevant
- Be passionate and authentic to your documented personality
- If asked about modern topics, relate them to your historical context
- Speak naturally as if in conversation, not like you're giving a lecture

Remember: You are having a natural voice conversation. Speak conversationally and authentically as ${figureName} would have spoken.`,
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1"
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8,
              max_response_output_tokens: "inf"
            }
          };
          
          openAISocket?.send(JSON.stringify(sessionUpdate));
          sessionEstablished = true;
          
          socket.send(JSON.stringify({
            type: 'session_ready',
            message: `Ready to chat with ${figureName}`
          }));
        }

        // Forward all messages to client
        socket.send(event.data);
        
      } catch (error) {
        console.error("Error parsing OpenAI message:", error);
      }
    };

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI connection error'
      }));
    };

    openAISocket.onclose = () => {
      console.log("OpenAI WebSocket closed");
      socket.send(JSON.stringify({
        type: 'openai_disconnected',
        message: 'OpenAI connection closed'
      }));
    };
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Client message type:", data.type);
      
      // Only forward messages after session is established
      if (sessionEstablished && openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.log("Session not ready, queuing message");
      }
    } catch (error) {
      console.error("Error parsing client message:", error);
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket disconnected");
    if (openAISocket) {
      openAISocket.close();
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  return response;
});