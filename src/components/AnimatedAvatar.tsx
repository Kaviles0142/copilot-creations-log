import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Volume2, Loader2 } from 'lucide-react';

interface AnimatedAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  isSpeaking?: boolean;
  audioElement?: HTMLAudioElement | null;
  analyser?: AnalyserNode | null;
}

const AnimatedAvatar = ({ imageUrl, isLoading, isSpeaking, audioElement, analyser: externalAnalyser }: AnimatedAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [blinkTimer, setBlinkTimer] = useState(0);


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
    if (isSpeaking && externalAnalyser) {
      const dataArray = new Uint8Array(externalAnalyser.frequencyBinCount);
      externalAnalyser.getByteFrequencyData(dataArray);
      amplitude = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    }

    // Apply animations
    applyMouthAnimation(ctx, amplitude, canvas);
    applyBlinking(ctx, canvas);
    applyBreathing(ctx, canvas);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const applyMouthAnimation = (ctx: CanvasRenderingContext2D, amplitude: number, canvas: HTMLCanvasElement) => {
    if (!isSpeaking || amplitude < 0.1) return;

    // Portrait faces are typically in the upper 2/3 of the image
    // Mouth is about 70% down from top for a typical portrait
    const mouthY = canvas.height * 0.68; // ~348px for 512px canvas
    const mouthX = canvas.width / 2; // Center
    const mouthWidth = 30 + (amplitude * 50); // Dynamic width based on amplitude
    const mouthHeight = 8 + (amplitude * 35); // Dynamic height

    // Save context
    ctx.save();
    
    // More visible mouth overlay
    ctx.fillStyle = 'rgba(80, 40, 40, 0.6)';
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, mouthWidth / 2, mouthHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const applyBlinking = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Blink every 3-5 seconds
    setBlinkTimer((prev) => {
      const next = prev + 1;
      if (next % 120 === 0) { // Roughly every 2 seconds at 60fps
        // Eyes are about 45% down from top
        const eyeY = canvas.height * 0.42; // ~215px for 512px canvas
        const centerX = canvas.width / 2;
        const eyeSpacing = canvas.width * 0.12; // Distance from center
        const leftEyeX = centerX - eyeSpacing;
        const rightEyeX = centerX + eyeSpacing;

        ctx.save();
        ctx.fillStyle = 'rgba(40, 30, 30, 0.8)';
        // Draw eyelids
        ctx.fillRect(leftEyeX - 25, eyeY - 5, 50, 10);
        ctx.fillRect(rightEyeX - 25, eyeY - 5, 50, 10);
        ctx.restore();
      }
      return next % 180;
    });
  };

  const applyBreathing = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Subtle breathing effect using a very slight scale
    const breathingScale = 1 + Math.sin(Date.now() / 2000) * 0.008;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.setTransform(
      breathingScale, 0, 0, breathingScale,
      (1 - breathingScale) * centerX,
      (1 - breathingScale) * centerY
    );
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
  }, [imageUrl, isSpeaking, externalAnalyser]);

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
