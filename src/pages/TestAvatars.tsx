import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DITTO_WS_URL = "wss://cyvz85a1k93zep-8000.proxy.runpod.net/ws/stream";

export default function TestAvatars() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [text, setText] = useState(
    "Hello, I am Albert Einstein. The important thing is not to stop questioning. Curiosity has its own reason for existence.",
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [frameCount, setFrameCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Generate Einstein image on mount
  useEffect(() => {
    generateEinsteinImage();
  }, []);

  const generateEinsteinImage = async () => {
    setIsGeneratingImage(true);
    setStatus("Generating Einstein image...");

    try {
      const { data, error } = await supabase.functions.invoke("generate-einstein-image");

      if (error) {
        throw new Error(error.message || "Image generation failed");
      }

      const generatedImageUrl = data?.image_url;

      if (!generatedImageUrl) {
        throw new Error("No image returned from API");
      }

      setImageUrl(generatedImageUrl);

      // Extract base64 from data URL
      const base64Match = generatedImageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        setImageBase64(base64Match[1]);
      }

      setStatus("Einstein image generated!");
      toast({ title: "Image Generated", description: "Albert Einstein portrait ready" });
    } catch (error) {
      console.error("Error generating image:", error);
      setStatus("Failed to generate image");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const convertToFloat32PCM16k = async (audioBase64: string): Promise<Float32Array> => {
    // Decode base64 to array buffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create audio context for decoding
    const audioContext = new AudioContext({ sampleRate: 16000 });

    try {
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

      // Get the audio data and resample to 16kHz if needed
      const originalData = audioBuffer.getChannelData(0);
      const originalSampleRate = audioBuffer.sampleRate;

      if (originalSampleRate === 16000) {
        return originalData;
      }

      // Resample to 16kHz
      const ratio = originalSampleRate / 16000;
      const newLength = Math.floor(originalData.length / ratio);
      const resampledData = new Float32Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const originalIndex = Math.floor(i * ratio);
        resampledData[i] = originalData[originalIndex];
      }

      return resampledData;
    } finally {
      await audioContext.close();
    }
  };

  const float32ToBase64 = (float32Array: Float32Array): string => {
    const bytes = new Uint8Array(float32Array.buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startStreaming = async () => {
    if (!imageBase64) {
      toast({ title: "Error", description: "Please generate an image first", variant: "destructive" });
      return;
    }

    if (!text.trim()) {
      toast({ title: "Error", description: "Please enter text for TTS", variant: "destructive" });
      return;
    }

    setIsStreaming(true);
    setFrameCount(0);
    setStatus("Generating TTS audio...");

    try {
      // Step 1: Generate TTS audio using Azure (faster than RunPod)
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke("azure-text-to-speech", {
        body: {
          text,
          figure_name: "Albert Einstein",
          figure_id: "albert-einstein",
        },
      });

      if (ttsError || !ttsData?.audioContent) {
        throw new Error(ttsError?.message || "TTS generation failed");
      }

      console.log("✅ Azure TTS audio received, length:", ttsData.audioContent.length);
      setStatus("Converting audio to PCM...");

      // Step 2: Convert audio to float32 PCM 16kHz
      const pcmData = await convertToFloat32PCM16k(ttsData.audioContent);
      console.log("✅ PCM data ready, samples:", pcmData.length);

      setStatus("Connecting to Ditto WebSocket...");

      // Step 3: Connect to Ditto WebSocket
      const ws = new WebSocket(DITTO_WS_URL);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("🔌 WebSocket connected");
        setStatus("Initializing avatar...");

        // Send init message
        ws.send(
          JSON.stringify({
            type: "init",
            image_b64: imageBase64,
            avatar_id: null,
            max_size: 1024,
            crop_scale: 2.0,
          }),
        );

        // Wait a bit for init to process
        await new Promise((resolve) => setTimeout(resolve, 500));

        setStatus("Streaming audio chunks...");

        // Send audio in chunks with [4,8,2] chunksize pattern
        const chunkSize = 4 * 8 * 2 * 100; // Multiply by 100 for reasonable chunk sizes
        let offset = 0;

        while (offset < pcmData.length) {
          const chunk = pcmData.slice(offset, offset + chunkSize);
          const chunkBase64 = float32ToBase64(chunk);

          ws.send(
            JSON.stringify({
              type: "audio_chunk",
              audio_b64: chunkBase64,
              sample_rate: 16000,
              chunksize: [4, 8, 2],
            }),
          );

          offset += chunkSize;

          // Small delay to avoid overload
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        // Send end signal
        ws.send(JSON.stringify({ type: "end" }));
        setStatus("Audio sent, waiting for frames...");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "frame" && message.data) {
            setFrameCount((prev) => prev + 1);

            // Draw frame on canvas
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                };
                img.src = `data:image/${message.format || "jpeg"};base64,${message.data}`;
              }
            }
          } else if (message.type === "error") {
            console.error("Ditto error:", message);
            setStatus(`Error: ${message.message || "Unknown error"}`);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("WebSocket error");
        toast({ title: "WebSocket Error", description: "Connection failed", variant: "destructive" });
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        setStatus(`Complete! Received ${frameCount} frames`);
        setIsStreaming(false);
        wsRef.current = null;
      };
    } catch (error) {
      console.error("Streaming error:", error);
      setStatus("Error: " + (error instanceof Error ? error.message : "Unknown"));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Streaming failed",
        variant: "destructive",
      });
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    setStatus("Stopped");
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Avatar Streaming Test</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Image Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Einstein Portrait
                <Button variant="outline" size="sm" onClick={generateEinsteinImage} disabled={isGeneratingImage}>
                  {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {isGeneratingImage ? (
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Generating Einstein...</p>
                  </div>
                ) : imageUrl ? (
                  <img src={imageUrl} alt="Generated Einstein" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-muted-foreground">No image generated</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Video Output */}
          <Card>
            <CardHeader>
              <CardTitle>Streaming Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full"
                  style={{ display: frameCount > 0 ? "block" : "none" }}
                />
                {frameCount === 0 && <p className="text-white/50">Waiting for stream...</p>}
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">Frames received: {frameCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* TTS Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Text-to-Speech Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tts-text">Text for Einstein to speak</Label>
              <Textarea
                id="tts-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text for TTS..."
                className="mt-2"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={isStreaming ? stopStreaming : startStreaming}
                disabled={!imageBase64 || isGeneratingImage}
                className="flex-1"
                variant={isStreaming ? "destructive" : "default"}
              >
                {isStreaming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate & Stream Avatar
                  </>
                )}
              </Button>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
