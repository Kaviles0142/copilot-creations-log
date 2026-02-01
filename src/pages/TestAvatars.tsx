import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw, Volume2, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AvatarTile } from "@/components/AvatarTile";
import { useIdleVideoPreloader } from "@/hooks/useIdleVideoPreloader";

export default function TestAvatars() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [text, setText] = useState(
    "Hello, I am Albert Einstein. The important thing is not to stop questioning. Curiosity has its own reason for existence.",
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioPcm, setAudioPcm] = useState<Float32Array | null>(null);
  const [status, setStatus] = useState("Ready");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const { toast } = useToast();
  const { getIdleVideoUrl, isGenerating: isGeneratingIdle, getCachedUrl } = useIdleVideoPreloader();
  
  const [idleVideoUrl, setIdleVideoUrl] = useState<string | null>(null);
  const figureId = "albert-einstein";
  const figureName = "Albert Einstein";

  // Generate Einstein image on mount
  useEffect(() => {
    generateEinsteinImage();
  }, []);

  // Generate idle video when image is ready
  useEffect(() => {
    const generateIdle = async () => {
      if (imageBase64 && !idleVideoUrl && !isGeneratingIdle(figureId)) {
        console.log("🎬 Generating idle video...");
        setStatus("Generating idle loop video...");
        const url = await getIdleVideoUrl(figureId, imageBase64, figureName);
        if (url) {
          setIdleVideoUrl(url);
          setStatus("Idle video ready!");
        } else {
          setStatus("Idle video generation failed - using static image");
        }
      }
    };
    generateIdle();
  }, [imageBase64, idleVideoUrl, figureId, getIdleVideoUrl, isGeneratingIdle]);

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

  const startStreaming = async () => {
    if (!imageBase64) {
      toast({ title: "Error", description: "Please generate an image first", variant: "destructive" });
      return;
    }

    if (!text.trim()) {
      toast({ title: "Error", description: "Please enter text for TTS", variant: "destructive" });
      return;
    }

    setIsGeneratingAudio(true);
    setStatus("Generating TTS audio...");

    try {
      // Step 1: Generate TTS audio using Azure
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke("azure-text-to-speech", {
        body: {
          text,
          figure_name: figureName,
          figure_id: figureId,
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

      // Step 3: Set speaking state and pass audio to AvatarTile
      setAudioPcm(pcmData);
      setIsSpeaking(true);
      setStatus("Streaming live video...");
      setIsGeneratingAudio(false);
    } catch (error) {
      console.error("Error:", error);
      setStatus("Error: " + (error instanceof Error ? error.message : "Unknown"));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate audio",
        variant: "destructive",
      });
      setIsGeneratingAudio(false);
    }
  };

  const stopStreaming = () => {
    setIsSpeaking(false);
    setAudioPcm(null);
    setStatus("Stopped");
  };

  const handleSpeakingEnd = useCallback(() => {
    setIsSpeaking(false);
    setAudioPcm(null);
    setStatus("Stream complete - back to idle");
  }, []);

  const isIdleVideoGenerating = isGeneratingIdle(figureId);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Avatar Streaming Test</h1>
        <p className="text-muted-foreground">
          Zoom-like avatar tile with idle loop video + live stream swap
        </p>

        {/* Main Avatar Tile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {figureName}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={generateEinsteinImage} 
                disabled={isGeneratingImage || isSpeaking}
              >
                {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <AvatarTile
                figureName={figureName}
                figureId={figureId}
                avatarImageUrl={imageUrl}
                idleVideoUrl={idleVideoUrl}
                isLoading={isGeneratingImage || isIdleVideoGenerating}
                isSpeaking={isSpeaking}
                audioPcm={audioPcm}
                imageBase64={imageBase64}
                showStatusBadge={true}
                onSpeakingEnd={handleSpeakingEnd}
                className="w-full h-full"
              />
            </div>
            
            {/* Status indicators */}
            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Image</p>
                <p className={imageBase64 ? "text-primary" : "text-muted-foreground"}>
                  {imageBase64 ? "✅ Ready" : isGeneratingImage ? "⏳ Generating..." : "❌ None"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Idle Video</p>
                <p className={idleVideoUrl ? "text-primary" : "text-muted-foreground"}>
                  {idleVideoUrl ? "✅ Ready" : isIdleVideoGenerating ? "⏳ Generating..." : "❌ None"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Mode</p>
                <p className={isSpeaking ? "text-primary font-bold" : "text-muted-foreground"}>
                  {isSpeaking ? "🔴 LIVE" : "🟢 IDLE"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                disabled={isSpeaking}
              />
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={isSpeaking ? stopStreaming : startStreaming}
                disabled={!imageBase64 || isGeneratingImage || isGeneratingAudio}
                className="flex-1"
                variant={isSpeaking ? "destructive" : "default"}
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating Audio...
                  </>
                ) : isSpeaking ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Speaking
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Make Einstein Speak
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
