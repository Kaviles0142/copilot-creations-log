import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Volume2, Loader2 } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import Meyda from 'meyda';

interface AnimatedAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  isSpeaking?: boolean;
  audioElement?: HTMLAudioElement | null;
  analyser?: AnalyserNode | null;
}

// Clean viseme shape parameters for different phonemes - scaled naturally with amplitude
const getVisemeParameters = (viseme: string, amplitude: number) => {
  const baseParams = {
    neutral: { upperLip: 0, lowerLip: 0, jawDrop: 0, width: 0, cornerPull: 0, lipPucker: 0 },
    A: { upperLip: 30, lowerLip: 80, jawDrop: 70, width: 20, cornerPull: 1.2, lipPucker: 0 }, // Open mouth
    E: { upperLip: 10, lowerLip: 30, jawDrop: 25, width: 35, cornerPull: 2.5, lipPucker: 0 }, // Smile
    I: { upperLip: 8, lowerLip: 20, jawDrop: 18, width: 40, cornerPull: 3.0, lipPucker: 0 }, // Wide smile
    O: { upperLip: 20, lowerLip: 50, jawDrop: 45, width: 5, cornerPull: 0.2, lipPucker: 3.5 }, // Round
    U: { upperLip: 18, lowerLip: 45, jawDrop: 40, width: 3, cornerPull: 0.1, lipPucker: 4.5 }, // Very round
    M: { upperLip: 2, lowerLip: 2, jawDrop: 5, width: 2, cornerPull: 0.2, lipPucker: 0 }, // Lips closed
    F: { upperLip: 5, lowerLip: 12, jawDrop: 15, width: 15, cornerPull: 0.8, lipPucker: 0 }, // Teeth on lip
    S: { upperLip: 6, lowerLip: 15, jawDrop: 20, width: 18, cornerPull: 1.0, lipPucker: 0 }, // Teeth close
  };
  
  const params = baseParams[viseme as keyof typeof baseParams] || baseParams.neutral;
  
  // Scale all parameters by amplitude (single scaling point)
  return {
    upperLip: params.upperLip * amplitude,
    lowerLip: params.lowerLip * amplitude,
    jawDrop: params.jawDrop * amplitude,
    width: params.width * amplitude,
    cornerPull: params.cornerPull * amplitude,
    lipPucker: params.lipPucker * amplitude,
  };
};

const AnimatedAvatar = ({ imageUrl, isLoading, isSpeaking, audioElement, analyser: externalAnalyser }: AnimatedAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [blinkTimer, setBlinkTimer] = useState(0);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const [faceMesh, setFaceMesh] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const amplitudeHistory = useRef<number[]>([]);
  const [currentViseme, setCurrentViseme] = useState<string>('neutral');
  const targetVisemeRef = useRef<string>('neutral'); // Changed to ref for immediate updates
  const visemeBlend = useRef<number>(0);
  const expressionIntensity = useRef<number>(0);
  const headTilt = useRef<number>(0);
  
  // Debug when props change
  useEffect(() => {
    console.log('🎤 AnimatedAvatar props updated:', { isSpeaking, hasAnalyser: !!externalAnalyser });
  }, [isSpeaking, externalAnalyser]);


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
    if (!imageUrl || !modelsLoaded || !faceLandmarkerRef.current) {
      console.log('⏸️ Skipping face detection:', { imageUrl: !!imageUrl, modelsLoaded, hasLandmarker: !!faceLandmarkerRef.current });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      imageRef.current = img;
      
      // Try multiple detection strategies
      const tryDetectFace = async (imageSource: HTMLImageElement | HTMLCanvasElement, attempt: number = 1) => {
        try {
          console.log(`🔍 Detecting face mesh (attempt ${attempt})...`);
          const results = faceLandmarkerRef.current!.detect(imageSource);
          
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            
            // MediaPipe provides 478 landmarks - we need specific ones for mouth and eyes
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
            return true;
          }
          return false;
        } catch (error) {
          console.error(`❌ Error detecting face mesh (attempt ${attempt}):`, error);
          return false;
        }
      };
      
      // First attempt: Try with original image
      let detected = await tryDetectFace(img, 1);
      
      // Second attempt: Try with enhanced contrast/brightness
      if (!detected) {
        console.log('🎨 Trying with enhanced image...');
        const enhancedCanvas = document.createElement('canvas');
        enhancedCanvas.width = 512;
        enhancedCanvas.height = 512;
        const enhancedCtx = enhancedCanvas.getContext('2d');
        
        if (enhancedCtx) {
          // Draw image with enhanced brightness/contrast
          enhancedCtx.filter = 'brightness(1.2) contrast(1.3)';
          enhancedCtx.drawImage(img, 0, 0, 512, 512);
          enhancedCtx.filter = 'none';
          
          detected = await tryDetectFace(enhancedCanvas, 2);
        }
      }
      
      // Third attempt: Try with different brightness/contrast
      if (!detected) {
        console.log('🎨 Trying with alternate enhancement...');
        const enhancedCanvas = document.createElement('canvas');
        enhancedCanvas.width = 512;
        enhancedCanvas.height = 512;
        const enhancedCtx = enhancedCanvas.getContext('2d');
        
        if (enhancedCtx) {
          // Try with different filter settings
          enhancedCtx.filter = 'brightness(0.9) contrast(1.5) saturate(1.2)';
          enhancedCtx.drawImage(img, 0, 0, 512, 512);
          enhancedCtx.filter = 'none';
          
          detected = await tryDetectFace(enhancedCanvas, 3);
        }
      }
      
      if (!detected) {
        console.warn('⚠️ No face detected after all attempts, using fallback animation');
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

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw base image to a temporary canvas for warping
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Get audio amplitude and detect phonemes/visemes
    let amplitude = 0;
    
    if (isSpeaking && externalAnalyser) {
      const dataArray = new Uint8Array(externalAnalyser.frequencyBinCount);
      externalAnalyser.getByteFrequencyData(dataArray);
      
      const currentAmplitude = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      
      // Log only occasionally to avoid spam
      if (Math.random() < 0.05) {
        console.log('🎵 Amplitude:', currentAmplitude.toFixed(3), 'Max:', Math.max(...dataArray));
      }
      
      // Detect phoneme using Meyda audio features
      const detectedViseme = detectVisemeFromMeyda(externalAnalyser);
      
      // Smooth viseme transitions with easing
      if (detectedViseme !== targetVisemeRef.current) {
        targetVisemeRef.current = detectedViseme;
        visemeBlend.current = 0;
      } else {
        // Slower, smoother blend using easing (cubic ease-out)
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        visemeBlend.current = Math.min(1, visemeBlend.current + 0.08);
        visemeBlend.current = easeOut(visemeBlend.current);
      }
      
      // Animate expression intensity
      expressionIntensity.current = currentAmplitude * 1.5;
      headTilt.current = Math.sin(Date.now() / 800) * currentAmplitude * 2;
      
      // Add delay buffer for natural lip sync
      amplitudeHistory.current.push(currentAmplitude);
      if (amplitudeHistory.current.length > 3) {
        amplitudeHistory.current.shift();
      }
      amplitude = amplitudeHistory.current[0] || currentAmplitude;
    } else {
      // Log state occasionally when not speaking
      if (Math.random() < 0.01) {
        console.log('⏸️ Not speaking - isSpeaking:', isSpeaking, 'hasAnalyser:', !!externalAnalyser);
      }
      
      // Blend back to neutral
      if (targetVisemeRef.current !== 'neutral') {
        targetVisemeRef.current = 'neutral';
        visemeBlend.current = 0;
      } else {
        visemeBlend.current = Math.min(1, visemeBlend.current + 0.1);
      }
      expressionIntensity.current = Math.max(0, expressionIntensity.current - 0.05);
      headTilt.current *= 0.95;
    }

    // Log critical state once when it changes
    const shouldWarp = !!(faceMesh && isSpeaking);
    const shouldAnimateWithoutMesh = !faceMesh && isSpeaking && amplitude > 0.05;
    
    if (Math.random() < 0.02) {
      console.log('🧠 faceMesh:', !!faceMesh, '| 🎤 isSpeaking:', isSpeaking, '| 📊 amplitude:', amplitude.toFixed(3), '| ✅ willWarp:', shouldWarp, '| 🎭 fallback:', shouldAnimateWithoutMesh);
    }

    // Apply PIXEL WARPING or FALLBACK ANIMATION
    if (shouldWarp) {
      // Apply controlled 3.5x amplification (single scaling point to make movement visible)
      const effectiveAmplitude = Math.min(1, amplitude * 3.5);
      
      const blendedViseme = effectiveAmplitude > 0.05 
        ? getBlendedViseme(currentViseme, targetVisemeRef.current, visemeBlend.current, effectiveAmplitude)
        : getVisemeParameters('neutral', 1);
      
      // Log warping action occasionally
      if (Math.random() < 0.05) {
        console.log('🎭 WARPING:', { 
          raw: amplitude.toFixed(3),
          effective: effectiveAmplitude.toFixed(3),
          current: currentViseme,
          target: targetVisemeRef.current,
          blend: visemeBlend.current.toFixed(2),
          jaw: blendedViseme.jawDrop.toFixed(1)
        });
      }
      
      applyFullFaceWarping(ctx, tempCtx, effectiveAmplitude, canvas, blendedViseme, expressionIntensity.current, effectiveAmplitude > 0.05);
    } else if (shouldAnimateWithoutMesh) {
      // Fallback: Simple scaling animation when face mesh isn't detected
      const effectiveAmplitude = Math.min(1, amplitude * 3.5);
      const scale = 1 + (effectiveAmplitude * 0.02); // Subtle scaling
      
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
      
      if (Math.random() < 0.05) {
        console.log('🎭 FALLBACK ANIMATION:', { amplitude: amplitude.toFixed(3), scale: scale.toFixed(3) });
      }
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }
    
    applyNaturalBlinking(ctx, canvas);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  // Blend between two viseme parameter sets with smooth easing
  const getBlendedViseme = (fromViseme: string, toViseme: string, blend: number, amp: number) => {
    // Apply smooth easing to blend value (ease-in-out)
    const easeInOut = (t: number) => t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    const smoothBlend = easeInOut(blend);
    
    const from = getVisemeParameters(fromViseme, amp);
    const to = getVisemeParameters(toViseme, amp);
    
    return {
      upperLip: from.upperLip + (to.upperLip - from.upperLip) * smoothBlend,
      lowerLip: from.lowerLip + (to.lowerLip - from.lowerLip) * smoothBlend,
      jawDrop: from.jawDrop + (to.jawDrop - from.jawDrop) * smoothBlend,
      width: from.width + (to.width - from.width) * smoothBlend,
      cornerPull: from.cornerPull + (to.cornerPull - from.cornerPull) * smoothBlend,
      lipPucker: from.lipPucker + (to.lipPucker - from.lipPucker) * smoothBlend,
    };
  };

  const detectVisemeFromMeyda = (analyser: AnalyserNode): string => {
    const bufferLength = analyser.fftSize;
    const audioBuffer = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(audioBuffer);
    
    // Extract audio features using Meyda
    // @ts-ignore - Meyda typing issues
    const features = Meyda.extract(['mfcc', 'spectralCentroid', 'rms', 'zcr'], audioBuffer);
    
    if (!features || !features.mfcc) return 'neutral';
    
    const { mfcc, spectralCentroid, rms, zcr } = features as any;
    
    // Use MFCC coefficients and other features for phoneme detection
    const mfcc0 = mfcc[0] || 0;
    const mfcc1 = mfcc[1] || 0;
    const mfcc2 = mfcc[2] || 0;
    const centroid = spectralCentroid || 0;
    const energy = rms || 0;
    const zeroCrossing = zcr || 0;
    
    console.log('🎵 Meyda Features:', { 
      mfcc0: mfcc0.toFixed(2), 
      mfcc1: mfcc1.toFixed(2), 
      mfcc2: mfcc2.toFixed(2),
      centroid: centroid.toFixed(2), 
      energy: energy.toFixed(4),
      zcr: zeroCrossing.toFixed(4)
    });
    
    // Low energy threshold - adjusted for actual values
    if (energy < 0.005) return 'neutral';
    
    let detectedViseme = 'neutral';
    
    // Adjusted vowel detection based on ACTUAL Meyda output ranges
    // Spectral centroid is in 100-130 range, MFCCs are 0-60
    
    // High energy speech (A, E vowels)
    if (energy > 0.08 && mfcc0 > 40) {
      detectedViseme = 'A';
    }
    // Mid-high energy with higher MFCC1 (E vowel)
    else if (energy > 0.05 && mfcc1 > 30) {
      detectedViseme = 'E';
    }
    // High ZCR indicates fricatives (S, F sounds)
    else if (zeroCrossing > 30) {
      detectedViseme = 'S';
    }
    // High MFCC2 relative to others (I vowel)
    else if (mfcc2 > mfcc1 && energy > 0.04) {
      detectedViseme = 'I';
    }
    // Low MFCC2, rounded sounds (O, U)
    else if (mfcc2 < 20 && energy > 0.03) {
      if (mfcc0 > 50) {
        detectedViseme = 'O';
      } else {
        detectedViseme = 'U';
      }
    }
    // Low ZCR, nasal sounds (M, N)
    else if (zeroCrossing < 10 && energy > 0.02) {
      detectedViseme = 'M';
    }
    
    console.log('🎯 Detected Viseme:', detectedViseme);
    
    return detectedViseme;
  };

  const applyFullFaceWarping = (
    ctx: CanvasRenderingContext2D,
    tempCtx: CanvasRenderingContext2D,
    amplitude: number, 
    canvas: HTMLCanvasElement, 
    visemeParams: any,
    intensity: number,
    isSpeaking: boolean
  ) => {
    if (!faceMesh) return;
    
    const { landmarks, mouthOuter, leftEyeIndices, rightEyeIndices } = faceMesh;
    
    // Get mouth position
    const mouthPoints = mouthOuter.map((idx: number) => landmarks[idx]);
    const mouthXs = mouthPoints.map((p: any) => p.x);
    const mouthYs = mouthPoints.map((p: any) => p.y);
    const mouthX = (Math.min(...mouthXs) + Math.max(...mouthXs)) / 2;
    const mouthY = (Math.min(...mouthYs) + Math.max(...mouthYs)) / 2;
    const mouthWidth = Math.max(...mouthXs) - Math.min(...mouthXs);
    const mouthHeight = Math.max(...mouthYs) - Math.min(...mouthYs);
    
    // Get eyebrow landmarks
    const leftBrowIndices = [70, 63, 105, 66, 107];
    const rightBrowIndices = [336, 296, 334, 293, 300];
    const leftBrowPoints = leftBrowIndices.map((idx: number) => landmarks[idx]);
    const rightBrowPoints = rightBrowIndices.map((idx: number) => landmarks[idx]);
    const leftBrowY = leftBrowPoints.reduce((sum: number, p: any) => sum + p.y, 0) / leftBrowPoints.length;
    const rightBrowY = rightBrowPoints.reduce((sum: number, p: any) => sum + p.y, 0) / rightBrowPoints.length;
    
    // Get eye positions
    const leftEyePoints = leftEyeIndices.map((idx: number) => landmarks[idx]);
    const rightEyePoints = rightEyeIndices.map((idx: number) => landmarks[idx]);
    const leftEyeX = leftEyePoints.reduce((sum: number, p: any) => sum + p.x, 0) / leftEyePoints.length;
    const leftEyeY = leftEyePoints.reduce((sum: number, p: any) => sum + p.y, 0) / leftEyePoints.length;
    const rightEyeX = rightEyePoints.reduce((sum: number, p: any) => sum + p.x, 0) / rightEyePoints.length;
    const rightEyeY = rightEyePoints.reduce((sum: number, p: any) => sum + p.y, 0) / rightEyePoints.length;
    
    // Define full face warp region
    const faceTop = Math.min(leftBrowY, rightBrowY) - 40;
    const faceBottom = mouthY + mouthHeight + 60;
    const faceLeft = Math.min(leftEyeX - 60, mouthX - mouthWidth);
    const faceRight = Math.max(rightEyeX + 60, mouthX + mouthWidth);
    
    const regionX = Math.max(0, Math.floor(faceLeft));
    const regionY = Math.max(0, Math.floor(faceTop));
    const regionWidth = Math.min(canvas.width - regionX, Math.ceil(faceRight - faceLeft));
    const regionHeight = Math.min(canvas.height - regionY, Math.ceil(faceBottom - faceTop));
    
    try {
      // Get the image data from the TEMP canvas (not the main canvas)
      const fullImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      const fullPixels = fullImageData.data;
      
      // Create output for entire canvas
      const outputData = ctx.createImageData(canvas.width, canvas.height);
      const output = outputData.data;
      
      // Copy entire image first
      output.set(fullPixels);
      
      // Warp only the face region
      for (let y = 0; y < regionHeight; y++) {
        for (let x = 0; x < regionWidth; x++) {
          const canvasX = regionX + x;
          const canvasY = regionY + y;
          
          // Start with no offset
          let deltaX = 0;
          let deltaY = 0;
          
          // EYEBROW WARPING - raise based on expression intensity and open vowels
          const leftBrowDist = Math.sqrt(Math.pow(canvasX - leftEyeX, 2) + Math.pow(canvasY - leftBrowY, 2));
          const rightBrowDist = Math.sqrt(Math.pow(canvasX - rightEyeX, 2) + Math.pow(canvasY - rightBrowY, 2));
          
          if (leftBrowDist < 60 && isSpeaking && amplitude > 0.05) {
            const browStrength = 1 - (leftBrowDist / 60);
            // Raise eyebrows during speech, especially for wide mouth shapes
            const browRaise = amplitude * (visemeParams.jawDrop / 15 + visemeParams.cornerPull * 4) * browStrength;
            deltaY += browRaise;
          }
          if (rightBrowDist < 60 && isSpeaking && amplitude > 0.05) {
            const browStrength = 1 - (rightBrowDist / 60);
            const browRaise = amplitude * (visemeParams.jawDrop / 15 + visemeParams.cornerPull * 4) * browStrength;
            deltaY += browRaise;
          }
          
          // EYE SQUINTING - narrow eyes during smiles and wide vowels
          const leftEyeDist = Math.sqrt(Math.pow(canvasX - leftEyeX, 2) + Math.pow(canvasY - leftEyeY, 2));
          const rightEyeDist = Math.sqrt(Math.pow(canvasX - rightEyeX, 2) + Math.pow(canvasY - rightEyeY, 2));
          
          // Squint based on corner pull (smile) and amplitude
          const squintAmount = amplitude * visemeParams.cornerPull * 6;
          
          if (leftEyeDist < 35 && isSpeaking && amplitude > 0.05) {
            const squintStrength = 1 - (leftEyeDist / 35);
            // Narrow the eye vertically
            if (canvasY > leftEyeY - 5 && canvasY < leftEyeY + 15) {
              deltaY -= squintAmount * squintStrength;
            }
          }
          if (rightEyeDist < 35 && isSpeaking && amplitude > 0.05) {
            const squintStrength = 1 - (rightEyeDist / 35);
            if (canvasY > rightEyeY - 5 && canvasY < rightEyeY + 15) {
              deltaY -= squintAmount * squintStrength;
            }
          }
          
          // MOUTH WARPING
          const mouthDist = Math.sqrt(Math.pow(canvasX - mouthX, 2) + Math.pow(canvasY - mouthY, 2));
          const mouthRadius = Math.max(mouthWidth, mouthHeight) * 0.8;
          
          if (mouthDist < mouthRadius && isSpeaking && amplitude > 0.05) {
            const dx = canvasX - mouthX;
            const dy = canvasY - mouthY;
            const strength = 1 - (mouthDist / mouthRadius);
            const warpAmount = strength * strength * strength;
            
            const isInMouthZone = Math.abs(dx) < mouthWidth * 0.7;
            
            if (isInMouthZone) {
              // Upper lip
              if (dy < 0 && dy > -mouthHeight * 1.2) {
                const upperLipStrength = Math.abs(dy) / (mouthHeight * 1.2);
                const pullUp = amplitude * visemeParams.upperLip * warpAmount * (1 - upperLipStrength);
                deltaY += pullUp;
              }
              
              // Lower lip & jaw
              if (dy >= 0) {
                const jawStrength = Math.min(2, 1 + (dy / (mouthHeight * 0.8)));
                const pullDown = amplitude * visemeParams.lowerLip * warpAmount * jawStrength;
                deltaY -= pullDown;
              }
              
              // Horizontal stretch or pucker
              const cornerStrength = Math.abs(dx) / (mouthWidth * 0.7);
              
              if (visemeParams.lipPucker > 0) {
                const puckerAmount = visemeParams.lipPucker * warpAmount * cornerStrength * amplitude;
                deltaX += dx > 0 ? puckerAmount : -puckerAmount;
              } else {
                const pullSide = amplitude * visemeParams.width * warpAmount * cornerStrength * visemeParams.cornerPull;
                deltaX += dx > 0 ? -pullSide : pullSide;
              }
            }
          }
          
          // Apply accumulated deltas - read from source position in full image
          const sourceX = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvasX + deltaX)));
          const sourceY = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvasY + deltaY)));
          
          // Copy pixel from source to output
          const sourceIdx = (sourceY * canvas.width + sourceX) * 4;
          const outputIdx = (canvasY * canvas.width + canvasX) * 4;
          
          output[outputIdx] = fullPixels[sourceIdx];
          output[outputIdx + 1] = fullPixels[sourceIdx + 1];
          output[outputIdx + 2] = fullPixels[sourceIdx + 2];
          output[outputIdx + 3] = fullPixels[sourceIdx + 3];
        }
      }
      
      // Clear canvas and put back the entire warped image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(outputData, 0, 0);
    } catch (error) {
      console.warn('⚠️ Face warping failed:', error);
    }
  };

  const applyNaturalBlinking = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
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

  const applyBreathing = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, tilt: number = 0) => {
    // Much more subtle breathing effect - barely noticeable
    const breathingScale = 1 + Math.sin(Date.now() / 2000) * 0.002; // Reduced from 0.008 to 0.002
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Very subtle head tilt only during speech (reduced rotation)
    const rotation = (tilt * 0.3 * Math.PI) / 180; // Reduced from full tilt to 30%
    
    ctx.setTransform(
      breathingScale * Math.cos(rotation), 
      breathingScale * Math.sin(rotation),
      -breathingScale * Math.sin(rotation), 
      breathingScale * Math.cos(rotation),
      (1 - breathingScale) * centerX,
      (1 - breathingScale) * centerY
    );
  };

  useEffect(() => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    
    console.log('🔄 Restarting animation with isSpeaking:', isSpeaking, 'hasAnalyser:', !!externalAnalyser);
    
    if (imageUrl && imageRef.current) {
      drawFrame();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    </Card>
  );
};

export default AnimatedAvatar;
