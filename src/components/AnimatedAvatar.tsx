import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Volume2, Loader2 } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

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
  const [faceLandmarks, setFaceLandmarks] = useState<{ mouth: { x: number; y: number; width: number; height: number } | null; eyes: { left: { x: number; y: number }; right: { x: number; y: number } } | null }>({ mouth: null, eyes: null });
  const [modelsLoaded, setModelsLoaded] = useState(false);


  // Load face-api models from official CDN
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        console.log('✅ Face detection models loaded successfully');
      } catch (error) {
        console.error('❌ Error loading face detection models:', error);
        // Fallback - still allow animation with default positions
        setModelsLoaded(true);
        console.log('⚠️ Using default face positions (no detection)');
      }
    };
    loadModels();
  }, []);

  // Load image and detect facial landmarks
  useEffect(() => {
    if (!imageUrl || !modelsLoaded) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      imageRef.current = img;
      
      // Detect facial landmarks - wait for image to be fully loaded
      try {
        console.log('🔍 Starting face detection...');
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
          inputSize: 512,
          scoreThreshold: 0.5
        })).withFaceLandmarks();
        
        if (detection) {
          const landmarks = detection.landmarks;
          const mouthLandmarks = landmarks.getMouth();
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          
          // Calculate mouth bounding box
          const mouthXs = mouthLandmarks.map(p => p.x);
          const mouthYs = mouthLandmarks.map(p => p.y);
          const mouthX = (Math.min(...mouthXs) + Math.max(...mouthXs)) / 2;
          const mouthY = (Math.min(...mouthYs) + Math.max(...mouthYs)) / 2;
          const mouthWidth = Math.max(...mouthXs) - Math.min(...mouthXs);
          const mouthHeight = Math.max(...mouthYs) - Math.min(...mouthYs);
          
          // Calculate eye centers
          const leftEyeX = leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length;
          const leftEyeY = leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length;
          const rightEyeX = rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length;
          const rightEyeY = rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length;
          
          // CRITICAL: Scale coordinates from original image size to canvas size (512x512)
          const scaleX = 512 / img.width;
          const scaleY = 512 / img.height;
          
          console.log('📐 Scaling factors:', { scaleX, scaleY, imgWidth: img.width, imgHeight: img.height });
          
          setFaceLandmarks({
            mouth: { 
              x: mouthX * scaleX, 
              y: mouthY * scaleY, 
              width: mouthWidth * scaleX, 
              height: mouthHeight * scaleY 
            },
            eyes: {
              left: { x: leftEyeX * scaleX, y: leftEyeY * scaleY },
              right: { x: rightEyeX * scaleX, y: rightEyeY * scaleY }
            }
          });
          
          console.log('✅ Facial landmarks detected and scaled:', { 
            mouth: { 
              x: Math.round(mouthX * scaleX), 
              y: Math.round(mouthY * scaleY), 
              width: Math.round(mouthWidth * scaleX), 
              height: Math.round(mouthHeight * scaleY) 
            },
            eyes: { 
              left: { x: Math.round(leftEyeX * scaleX), y: Math.round(leftEyeY * scaleY) }, 
              right: { x: Math.round(rightEyeX * scaleX), y: Math.round(rightEyeY * scaleY) } 
            } 
          });
        } else {
          console.warn('⚠️ No face detected in image, using default positions');
        }
      } catch (error) {
        console.error('❌ Error detecting facial landmarks:', error);
      }
      
      drawFrame();
    };
    img.src = imageUrl;
  }, [imageUrl, modelsLoaded]);

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
    console.log('🎤 Mouth animation - isSpeaking:', isSpeaking, 'amplitude:', amplitude.toFixed(3));
    
    if (!isSpeaking || amplitude < 0.1) return;

    // Use detected mouth position or fallback to default
    const mouthY = faceLandmarks.mouth ? faceLandmarks.mouth.y : canvas.height * 0.68;
    const mouthX = faceLandmarks.mouth ? faceLandmarks.mouth.x : canvas.width / 2;
    const baseMouthWidth = faceLandmarks.mouth ? faceLandmarks.mouth.width : 60;
    const baseMouthHeight = faceLandmarks.mouth ? faceLandmarks.mouth.height : 16;
    
    const mouthWidth = baseMouthWidth * (1 + amplitude * 0.5);
    const mouthHeight = baseMouthHeight * (1 + amplitude * 1.2);

    console.log('👄 Drawing mouth at:', { x: Math.round(mouthX), y: Math.round(mouthY), width: Math.round(mouthWidth), height: Math.round(mouthHeight) });

    // Save context
    ctx.save();
    
    // Much more visible mouth overlay with bright red for debugging
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
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
        // Use detected eye positions or fallback to default
        const leftEyeX = faceLandmarks.eyes?.left.x || (canvas.width / 2 - canvas.width * 0.12);
        const leftEyeY = faceLandmarks.eyes?.left.y || (canvas.height * 0.42);
        const rightEyeX = faceLandmarks.eyes?.right.x || (canvas.width / 2 + canvas.width * 0.12);
        const rightEyeY = faceLandmarks.eyes?.right.y || (canvas.height * 0.42);

        ctx.save();
        ctx.fillStyle = 'rgba(40, 30, 30, 0.8)';
        // Draw eyelids
        ctx.fillRect(leftEyeX - 25, leftEyeY - 5, 50, 10);
        ctx.fillRect(rightEyeX - 25, rightEyeY - 5, 50, 10);
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
  }, [imageUrl, isSpeaking, externalAnalyser, faceLandmarks]);

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
