import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Volume2, Loader2 } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

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
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const [faceMesh, setFaceMesh] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const amplitudeHistory = useRef<number[]>([]);


  // Load MediaPipe Face Landmarker
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🔄 Loading MediaPipe Face Landmarker...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          numFaces: 1
        });
        
        faceLandmarkerRef.current = landmarker;
        setModelsLoaded(true);
        console.log('✅ MediaPipe Face Landmarker loaded successfully');
      } catch (error) {
        console.error('❌ Error loading MediaPipe models:', error);
        setModelsLoaded(true);
        console.log('⚠️ Using default face positions (no detection)');
      }
    };
    loadModels();
  }, []);

  // Load image and detect facial mesh with MediaPipe
  useEffect(() => {
    if (!imageUrl || !modelsLoaded || !faceLandmarkerRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      imageRef.current = img;
      
      try {
        console.log('🔍 Detecting face mesh with MediaPipe...');
        const results = faceLandmarkerRef.current!.detect(img);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          
          // MediaPipe provides 478 landmarks - we need specific ones for mouth and eyes
          // Mouth outer: indices 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308
          // Mouth inner: indices 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415
          // Left eye: indices 33, 160, 158, 133, 153, 144
          // Right eye: indices 362, 385, 387, 263, 373, 380
          
          const mouthOuter = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308];
          const leftEyeIndices = [33, 160, 158, 133, 153, 144];
          const rightEyeIndices = [362, 385, 387, 263, 373, 380];
          
          // Scale to canvas size
          const scaleX = 512;
          const scaleY = 512;
          
          setFaceMesh({
            landmarks: landmarks.map(l => ({ x: l.x * scaleX, y: l.y * scaleY, z: l.z })),
            mouthOuter,
            leftEyeIndices,
            rightEyeIndices
          });
          
          console.log('✅ Face mesh detected with 478 landmarks');
        } else {
          console.warn('⚠️ No face detected, using fallback');
        }
      } catch (error) {
        console.error('❌ Error detecting face mesh:', error);
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

    // Get audio amplitude if speaking with smoothing buffer
    let amplitude = 0;
    if (isSpeaking && externalAnalyser) {
      const dataArray = new Uint8Array(externalAnalyser.frequencyBinCount);
      externalAnalyser.getByteFrequencyData(dataArray);
      const currentAmplitude = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      
      // Add delay buffer for natural lip sync (50-100ms)
      amplitudeHistory.current.push(currentAmplitude);
      if (amplitudeHistory.current.length > 3) {
        amplitudeHistory.current.shift();
      }
      amplitude = amplitudeHistory.current[0] || currentAmplitude;
    }

    // Apply breathing animation to whole image
    applyBreathing(ctx, canvas);

    // Draw base image with breathing applied
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Reset transform after drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Apply facial animations using mesh
    if (isSpeaking && amplitude > 0.05) {
      applyMeshMouthAnimation(ctx, amplitude, canvas);
    }
    applyMeshBlinking(ctx, canvas);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const applyMeshMouthAnimation = (ctx: CanvasRenderingContext2D, amplitude: number, canvas: HTMLCanvasElement) => {
    if (!faceMesh) {
      // Fallback to center position
      const mouthX = canvas.width / 2;
      const mouthY = canvas.height * 0.7;
      drawMouthOpening(ctx, mouthX, mouthY, amplitude);
      return;
    }

    const { landmarks, mouthOuter } = faceMesh;
    
    // Get mouth landmarks
    const mouthPoints = mouthOuter.map((idx: number) => landmarks[idx]);
    
    // Calculate mouth center and dimensions
    const mouthXs = mouthPoints.map((p: any) => p.x);
    const mouthYs = mouthPoints.map((p: any) => p.y);
    const mouthX = (Math.min(...mouthXs) + Math.max(...mouthXs)) / 2;
    const mouthY = (Math.min(...mouthYs) + Math.max(...mouthYs)) / 2;
    
    drawMouthOpening(ctx, mouthX, mouthY, amplitude);
  };

  const drawMouthOpening = (ctx: CanvasRenderingContext2D, mouthX: number, mouthY: number, amplitude: number) => {
    ctx.save();
    
    // Calculate dynamic mouth opening
    const baseWidth = 50;
    const baseHeight = 14;
    const openHeight = baseHeight * (1 + amplitude * 10);
    const openWidth = baseWidth * (1 + amplitude * 1.2);
    const jawDrop = amplitude * 15;
    
    // Draw dark mouth cavity with gradient
    ctx.globalCompositeOperation = 'multiply';
    
    const gradient = ctx.createRadialGradient(
      mouthX, mouthY + jawDrop * 0.4,
      0,
      mouthX, mouthY + jawDrop * 0.4,
      openHeight
    );
    gradient.addColorStop(0, `rgba(5, 2, 2, ${Math.min(amplitude * 3, 0.98)})`);
    gradient.addColorStop(0.3, `rgba(15, 8, 8, ${Math.min(amplitude * 2.2, 0.85)})`);
    gradient.addColorStop(0.6, `rgba(30, 15, 15, ${Math.min(amplitude * 1.5, 0.6)})`);
    gradient.addColorStop(1, 'rgba(50, 25, 25, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(
      mouthX,
      mouthY + jawDrop * 0.4,
      openWidth * 0.8,
      openHeight * 0.7,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Add jaw shadow for larger openings
    if (amplitude > 0.2) {
      const jawGradient = ctx.createLinearGradient(
        mouthX, mouthY,
        mouthX, mouthY + jawDrop + 35
      );
      jawGradient.addColorStop(0, `rgba(0, 0, 0, ${amplitude * 0.3})`);
      jawGradient.addColorStop(0.6, `rgba(0, 0, 0, ${amplitude * 0.15})`);
      jawGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = jawGradient;
      ctx.fillRect(
        mouthX - openWidth * 1.3,
        mouthY,
        openWidth * 2.6,
        jawDrop + 35
      );
    }
    
    ctx.restore();
  };

  const applyMeshBlinking = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    setBlinkTimer((prev) => {
      const next = prev + 1;
      if (next % 150 === 0) {
        let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
        
        if (faceMesh) {
          const { landmarks, leftEyeIndices, rightEyeIndices } = faceMesh;
          
          // Get eye centers from mesh
          const leftEyePoints = leftEyeIndices.map((idx: number) => landmarks[idx]);
          const rightEyePoints = rightEyeIndices.map((idx: number) => landmarks[idx]);
          
          leftEyeX = leftEyePoints.reduce((sum: number, p: any) => sum + p.x, 0) / leftEyePoints.length;
          leftEyeY = leftEyePoints.reduce((sum: number, p: any) => sum + p.y, 0) / leftEyePoints.length;
          rightEyeX = rightEyePoints.reduce((sum: number, p: any) => sum + p.x, 0) / rightEyePoints.length;
          rightEyeY = rightEyePoints.reduce((sum: number, p: any) => sum + p.y, 0) / rightEyePoints.length;
        } else {
          // Fallback positions
          leftEyeX = canvas.width / 2 - canvas.width * 0.12;
          leftEyeY = canvas.height * 0.42;
          rightEyeX = canvas.width / 2 + canvas.width * 0.12;
          rightEyeY = canvas.height * 0.42;
        }

        ctx.save();
        ctx.fillStyle = 'rgba(40, 30, 30, 0.85)';
        ctx.fillRect(leftEyeX - 28, leftEyeY - 6, 56, 12);
        ctx.fillRect(rightEyeX - 28, rightEyeY - 6, 56, 12);
        ctx.restore();
      }
      return next % 200;
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
  }, [imageUrl, isSpeaking, externalAnalyser, faceMesh]);

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
