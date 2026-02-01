import { useRef, useState, useCallback, useEffect } from 'react';

interface UseDittoStreamOptions {
  wsUrl?: string;
  onFrame?: (frameBase64: string, format: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

interface UseDittoStreamReturn {
  isConnected: boolean;
  isStreaming: boolean;
  frameCount: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  startStream: (imageBase64: string, audioPcm: Float32Array) => Promise<void>;
  stopStream: () => void;
  reset: () => void;
}

const DEFAULT_WS_URL = 'wss://b3x5whv066zofk-8000.proxy.runpod.net/ws/stream';

export function useDittoStream(options: UseDittoStreamOptions = {}): UseDittoStreamReturn {
  const { wsUrl = DEFAULT_WS_URL, onFrame, onError, onComplete } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isStreamingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const float32ToBase64 = useCallback((float32Array: Float32Array): string => {
    const bytes = new Uint8Array(float32Array.buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const drawFrame = useCallback((frameBase64: string, format: string = 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/${format};base64,${frameBase64}`;
  }, []);

  const startStream = useCallback(async (imageBase64: string, audioPcm: Float32Array) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setFrameCount(0);
    setIsStreaming(true);
    isStreamingRef.current = true;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('🔌 Ditto WebSocket connected');
        setIsConnected(true);

        // Send init message
        ws.send(JSON.stringify({
          type: 'init',
          image_b64: imageBase64,
          avatar_id: null,
          max_size: 1024,
          crop_scale: 2.0,
        }));

        // Wait for init to process
        await new Promise(r => setTimeout(r, 500));

        // Send audio in chunks with [4,8,2] chunksize pattern
        const chunkSize = 4 * 8 * 2 * 100; // Multiply by 100 for reasonable chunk sizes
        let offset = 0;

        while (offset < audioPcm.length && isStreamingRef.current) {
          const chunk = audioPcm.slice(offset, offset + chunkSize);
          const chunkBase64 = float32ToBase64(chunk);

          ws.send(JSON.stringify({
            type: 'audio_chunk',
            audio_b64: chunkBase64,
            sample_rate: 16000,
            chunksize: [4, 8, 2],
          }));

          offset += chunkSize;
          
          // Small delay to avoid overload
          await new Promise(r => setTimeout(r, 250));
        }

        // Send end signal
        ws.send(JSON.stringify({ type: 'end' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'frame' && message.data) {
            setFrameCount(prev => prev + 1);
            drawFrame(message.data, message.format || 'jpeg');
            onFrame?.(message.data, message.format || 'jpeg');
          } else if (message.type === 'error') {
            console.error('Ditto error:', message);
            onError?.(new Error(message.message || 'Unknown Ditto error'));
          } else if (message.type === 'complete') {
            console.log('✅ Ditto stream complete');
            onComplete?.();
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        onError?.(new Error('WebSocket connection failed'));
        reject(error);
      };

      ws.onclose = () => {
        console.log('🔌 Ditto WebSocket closed');
        setIsConnected(false);
        setIsStreaming(false);
        isStreamingRef.current = false;
        wsRef.current = null;
        onComplete?.();
        resolve();
      };
    });
  }, [wsUrl, float32ToBase64, drawFrame, onFrame, onError, onComplete]);

  const stopStream = useCallback(() => {
    isStreamingRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    setIsConnected(false);
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setFrameCount(0);
  }, [stopStream]);

  return {
    isConnected,
    isStreaming,
    frameCount,
    canvasRef,
    startStream,
    stopStream,
    reset,
  };
}
