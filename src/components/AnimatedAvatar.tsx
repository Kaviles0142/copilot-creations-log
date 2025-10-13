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
          
          const faceMeshData = {
            landmarks: landmarks.map(l => ({ x: l.x * scaleX, y: l.y * scaleY, z: l.z })),
            mouthOuter,
            leftEyeIndices,
            rightEyeIndices
          };
          
          setFaceMesh(faceMeshData);
          
          console.log('✅ Face mesh detected with 478 landmarks');
          console.log('👄 Mouth position:', {
            x: faceMeshData.landmarks[61].x.toFixed(1),
            y: faceMeshData.landmarks[61].y.toFixed(1)
          });
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
      
      // Debug logging
      if (currentAmplitude > 0.05) {
        console.log('🎵 Audio amplitude:', currentAmplitude.toFixed(3));
      }
      
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

    // Apply PIXEL WARPING for mouth animation
    if (isSpeaking && amplitude > 0.05) {
      console.log('🗣️ Warping mouth pixels with amplitude:', amplitude.toFixed(3));
      applyMouthPixelWarping(ctx, amplitude, canvas);
    }
    
    applyMeshBlinking(ctx, canvas);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const applyMouthPixelWarping = (ctx: CanvasRenderingContext2D, amplitude: number, canvas: HTMLCanvasElement) => {
    // Get mouth position
    let mouthX, mouthY, mouthWidth, mouthHeight;
    
    if (faceMesh) {
      const { landmarks, mouthOuter } = faceMesh;
      const mouthPoints = mouthOuter.map((idx: number) => landmarks[idx]);
      const mouthXs = mouthPoints.map((p: any) => p.x);
      const mouthYs = mouthPoints.map((p: any) => p.y);
      mouthX = (Math.min(...mouthXs) + Math.max(...mouthXs)) / 2;
      mouthY = (Math.min(...mouthYs) + Math.max(...mouthYs)) / 2;
      mouthWidth = Math.max(...mouthXs) - Math.min(...mouthXs);
      mouthHeight = Math.max(...mouthYs) - Math.min(...mouthYs);
    } else {
      mouthX = canvas.width / 2;
      mouthY = canvas.height * 0.7;
      mouthWidth = 100;
      mouthHeight = 40;
    }

    // Calculate warp region - REDUCED to only affect mouth/jaw, not whole face
    const warpRadius = Math.max(mouthWidth, mouthHeight) * 0.8; // Much smaller radius
    const jawDrop = amplitude * 40; // Jaw drop amount
    const mouthOpen = amplitude * 10; // Horizontal opening
    
    const regionX = Math.max(0, Math.floor(mouthX - warpRadius));
    const regionY = Math.max(0, Math.floor(mouthY - warpRadius * 0.5)); // Start higher to capture upper lip
    const regionWidth = Math.min(canvas.width - regionX, Math.ceil(warpRadius * 2));
    const regionHeight = Math.min(canvas.height - regionY, Math.ceil(warpRadius * 1.5 + jawDrop)); // Extend down for jaw

    try {
      // Get the pixel data for the mouth region
      const imageData = ctx.getImageData(regionX, regionY, regionWidth, regionHeight);
      const pixels = imageData.data;
      
      // Create output buffer
      const outputData = ctx.createImageData(regionWidth, regionHeight);
      const output = outputData.data;
      
      // Warp pixels with asymmetric jaw movement
      for (let y = 0; y < regionHeight; y++) {
        for (let x = 0; x < regionWidth; x++) {
          // Convert to canvas coordinates
          const canvasX = regionX + x;
          const canvasY = regionY + y;
          
          // Distance from mouth center
          const dx = canvasX - mouthX;
          const dy = canvasY - mouthY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Only warp pixels within warp radius
          if (distance < warpRadius) {
            // Calculate warp strength (stronger near center)
            const strength = 1 - (distance / warpRadius);
            const warpAmount = strength * strength * strength; // Cubic falloff for smoother blend
            
            // Calculate displacement
            let sourceX = x;
            let sourceY = y;
            
            // LIP SEPARATION - pull lips apart vertically
            const lipZone = Math.abs(dy) < mouthHeight * 1.2;
            
            if (lipZone) {
              // Upper lip zone (slightly above center)
              if (dy < -mouthHeight * 0.1 && dy > -mouthHeight * 0.8) {
                // Pull upper lip UP slightly
                const upperLipPull = amplitude * 8 * warpAmount;
                sourceY = y + upperLipPull; // Pull UP (positive direction)
              }
              // Lower lip zone (at and below center)
              else if (dy >= -mouthHeight * 0.1) {
                // Pull lower lip DOWN more aggressively
                const lowerLipPull = amplitude * 40 * warpAmount;
                const jawProgression = Math.max(1, dy / (mouthHeight * 0.5)); // Stronger as you go down
                sourceY = y - (lowerLipPull * jawProgression); // Pull DOWN
              }
            }
            
            // HORIZONTAL STRETCH (corners pull outward)
            const horizontalZone = Math.abs(dy) < mouthHeight * 0.8;
            if (horizontalZone) {
              const cornerStrength = Math.min(1, Math.abs(dx) / (mouthWidth * 0.6));
              const pullAmount = mouthOpen * warpAmount * cornerStrength * 0.8;
              
              if (dx > 0) {
                sourceX = x - pullAmount;
              } else {
                sourceX = x + pullAmount;
              }
            }
            
            // Clamp source coordinates
            sourceX = Math.max(0, Math.min(regionWidth - 1, Math.floor(sourceX)));
            sourceY = Math.max(0, Math.min(regionHeight - 1, Math.floor(sourceY)));
            
            // Copy pixel from source to output
            const sourceIdx = (sourceY * regionWidth + sourceX) * 4;
            const outputIdx = (y * regionWidth + x) * 4;
            
            output[outputIdx] = pixels[sourceIdx];
            output[outputIdx + 1] = pixels[sourceIdx + 1];
            output[outputIdx + 2] = pixels[sourceIdx + 2];
            output[outputIdx + 3] = pixels[sourceIdx + 3];
          } else {
            // Outside warp radius, copy original pixel
            const idx = (y * regionWidth + x) * 4;
            output[idx] = pixels[idx];
            output[idx + 1] = pixels[idx + 1];
            output[idx + 2] = pixels[idx + 2];
            output[idx + 3] = pixels[idx + 3];
          }
        }
      }
      
      // Put warped pixels back
      ctx.putImageData(outputData, regionX, regionY);
      
      // Add dark mouth cavity when mouth opens - MORE VISIBLE
      if (amplitude > 0.1) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        
        // Create visible opening/cavity between lips
        const cavityWidth = mouthWidth * 0.5 * (1 + amplitude * 1.5);
        const cavityHeight = (amplitude * 25) + (mouthHeight * 0.3); // Height based on amplitude
        
        const gradient = ctx.createRadialGradient(
          mouthX, mouthY + (amplitude * 5), // Center slightly below mouth center
          0,
          mouthX, mouthY + (amplitude * 5),
          Math.max(cavityWidth, cavityHeight)
        );
        
        // Very dark center (almost black) fading out
        const darkness = Math.min(amplitude * 1.2, 0.95);
        gradient.addColorStop(0, `rgba(5, 2, 2, ${darkness})`);
        gradient.addColorStop(0.3, `rgba(15, 8, 8, ${darkness * 0.8})`);
        gradient.addColorStop(0.6, `rgba(30, 15, 15, ${darkness * 0.5})`);
        gradient.addColorStop(0.85, `rgba(50, 30, 30, ${darkness * 0.2})`);
        gradient.addColorStop(1, 'rgba(60, 40, 40, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
          mouthX,
          mouthY + (amplitude * 8), // Position cavity lower as mouth opens
          cavityWidth,
          cavityHeight,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
      
    } catch (error) {
      console.warn('⚠️ Pixel warping failed:', error);
    }
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
