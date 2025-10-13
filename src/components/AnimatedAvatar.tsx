import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Volume2, Loader2 } from 'lucide-react';

interface AnimatedAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  isSpeaking?: boolean;
  audioElement?: HTMLAudioElement | null;
}

const AnimatedAvatar = ({ imageUrl, isLoading, isSpeaking, audioElement }: AnimatedAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [blinkTimer, setBlinkTimer] = useState(0);

  // Initialize audio analysis
  useEffect(() => {
    if (!audioElement || !isSpeaking) return;

    const ctx = new AudioContext();
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;

    const source = ctx.createMediaElementSource(audioElement);
    source.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    setAudioContext(ctx);
    setAnalyser(analyserNode);

    return () => {
      ctx.close();
    };
  }, [audioElement, isSpeaking]);

  // Load image
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      drawFrame();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 512;
    canvas.height = 512;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Get audio amplitude if speaking
    let amplitude = 0;
    if (isSpeaking && analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      amplitude = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    }

    // Apply animations
    applyMouthAnimation(ctx, amplitude);
    applyBlinking(ctx);
    applyBreathing(ctx);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const applyMouthAnimation = (ctx: CanvasRenderingContext2D, amplitude: number) => {
    if (!isSpeaking || amplitude < 0.05) return;

    // Draw mouth opening based on audio amplitude
    const mouthY = 380; // Approximate mouth position
    const mouthX = 256; // Center
    const mouthWidth = 60;
    const mouthHeight = amplitude * 30; // Scale with amplitude

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const applyBlinking = (ctx: CanvasRenderingContext2D) => {
    // Blink every 3-5 seconds
    setBlinkTimer((prev) => {
      const next = prev + 1;
      if (next % 120 === 0) { // Roughly every 2 seconds at 60fps
        // Draw eyelids
        const eyeY = 240;
        const leftEyeX = 200;
        const rightEyeX = 312;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(leftEyeX - 20, eyeY - 10, 40, 8);
        ctx.fillRect(rightEyeX - 20, eyeY - 10, 40, 8);
      }
      return next % 180;
    });
  };

  const applyBreathing = (ctx: CanvasRenderingContext2D) => {
    // Subtle breathing effect using a very slight scale
    const breathingScale = 1 + Math.sin(Date.now() / 2000) * 0.005;
    ctx.setTransform(breathingScale, 0, 0, breathingScale, 
      (1 - breathingScale) * 256, (1 - breathingScale) * 256);
  };

  useEffect(() => {
    if (imageUrl && imageRef.current) {
      drawFrame();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [imageUrl, isSpeaking, analyser]);

  if (isLoading) {
    return (
      <Card className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generating avatar...</p>
        </div>
      </Card>
    );
  }

  if (!imageUrl) {
    return (
      <Card className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Select a historical figure to begin</p>
      </Card>
    );
  }

  return (
    <Card className="relative w-full max-w-md mx-auto aspect-square overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
      
      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-4 right-4 bg-primary/90 text-primary-foreground px-3 py-2 rounded-full flex items-center gap-2 animate-pulse">
          <Volume2 className="w-4 h-4" />
          <span className="text-xs font-medium">Speaking...</span>
        </div>
      )}

      {/* Glow effect when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-primary/10 animate-pulse" />
        </div>
      )}
    </Card>
  );
};

export default AnimatedAvatar;
