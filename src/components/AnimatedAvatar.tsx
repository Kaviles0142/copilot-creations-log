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
  const [targetViseme, setTargetViseme] = useState<string>('neutral');
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
      
      // DEBUG: Check what we're actually getting
      console.log('🔍 Analyser data check:', {
        frequencyBinCount: externalAnalyser.frequencyBinCount,
        dataArrayLength: dataArray.length,
        firstTenValues: Array.from(dataArray.slice(0, 10)),
        maxValue: Math.max(...dataArray),
        hasNonZero: dataArray.some(v => v > 0)
      });
      
      const currentAmplitude = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      
      console.log('🎵 Reading analyser - amplitude:', currentAmplitude.toFixed(3));
      
      // Detect phoneme from frequency analysis
      const detectedViseme = detectVisemeFromFrequency(dataArray, externalAnalyser.context.sampleRate);
      
      // Smooth viseme transitions
      if (detectedViseme !== targetViseme) {
        setTargetViseme(detectedViseme);
        visemeBlend.current = 0;
      } else {
        visemeBlend.current = Math.min(1, visemeBlend.current + 0.15);
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
      // Try to read analyser data anyway to test
      if (externalAnalyser) {
        const testDataArray = new Uint8Array(externalAnalyser.frequencyBinCount);
        externalAnalyser.getByteFrequencyData(testDataArray);
        const testSum = testDataArray.reduce((acc, val) => acc + val, 0);
        const testAverage = testSum / testDataArray.length;
        
        console.log('🧪 ANALYSER TEST (not speaking):', {
          isSpeaking,
          hasAnalyser: true,
          frequencyBinCount: externalAnalyser.frequencyBinCount,
          dataArraySum: testSum,
          averageAmplitude: testAverage.toFixed(3),
          maxValue: Math.max(...testDataArray),
          firstTenValues: Array.from(testDataArray.slice(0, 10))
        });
      } else {
        console.log('❌ No analyser available:', {
          isSpeaking,
          hasAnalyser: false
        });
      }
      
      // Blend back to neutral
      if (targetViseme !== 'neutral') {
        setTargetViseme('neutral');
        visemeBlend.current = 0;
      } else {
        visemeBlend.current = Math.min(1, visemeBlend.current + 0.1);
      }
      expressionIntensity.current = Math.max(0, expressionIntensity.current - 0.05);
      headTilt.current *= 0.95;
    }

    // DEBUG: Check state before warping
    console.log('🔍 Warping check:', {
      hasFaceMesh: !!faceMesh,
      faceMeshLandmarks: faceMesh?.landmarks?.length || 0,
      isSpeaking,
      hasAnalyser: !!externalAnalyser,
      amplitude: amplitude.toFixed(3),
      willWarp: !!(faceMesh && isSpeaking)
    });

    // Apply PIXEL WARPING
    if (faceMesh && isSpeaking) {
      // Apply controlled 3.5x amplification (single scaling point to make movement visible)
      const effectiveAmplitude = Math.min(1, amplitude * 3.5);
      
      const blendedViseme = effectiveAmplitude > 0.05 
        ? getBlendedViseme(currentViseme, targetViseme, visemeBlend.current, effectiveAmplitude)
        : getVisemeParameters('neutral', 1);
      
      console.log('🎭 WARPING NOW:', { 
        isSpeaking, 
        rawAmplitude: amplitude.toFixed(3),
        effectiveAmplitude: effectiveAmplitude.toFixed(3),
        viseme: targetViseme,
        jawDrop: blendedViseme.jawDrop.toFixed(1)
      });
      
      applyFullFaceWarping(ctx, tempCtx, effectiveAmplitude, canvas, blendedViseme, expressionIntensity.current, effectiveAmplitude > 0.05);
    } else {
      console.log('❌ NOT warping - faceMesh:', !!faceMesh, 'isSpeaking:', isSpeaking);
      ctx.drawImage(tempCanvas, 0, 0);
    }
    
    applyNaturalBlinking(ctx, canvas);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  // Blend between two viseme parameter sets (pass amplitude to get scaled values)
  const getBlendedViseme = (fromViseme: string, toViseme: string, blend: number, amp: number) => {
    // Get parameters with amplitude scaling already applied
    const from = getVisemeParameters(fromViseme, amp);
    const to = getVisemeParameters(toViseme, amp);
    
    return {
      upperLip: from.upperLip + (to.upperLip - from.upperLip) * blend,
      lowerLip: from.lowerLip + (to.lowerLip - from.lowerLip) * blend,
      jawDrop: from.jawDrop + (to.jawDrop - from.jawDrop) * blend,
      width: from.width + (to.width - from.width) * blend,
      cornerPull: from.cornerPull + (to.cornerPull - from.cornerPull) * blend,
      lipPucker: from.lipPucker + (to.lipPucker - from.lipPucker) * blend,
    };
  };

  const detectVisemeFromFrequency = (frequencyData: Uint8Array, sampleRate: number): string => {
    const binCount = frequencyData.length;
    
    // Analyze specific frequency ranges for phoneme detection
    // Low: 0-500Hz, Mid: 500-2000Hz, High: 2000Hz+
    const getLowEnergy = () => {
      let sum = 0;
      const endBin = Math.floor((500 / (sampleRate / 2)) * binCount);
      for (let i = 0; i < endBin; i++) sum += frequencyData[i];
      return (sum / endBin) / 255; // Normalize to 0-1
    };
    
    const getMidEnergy = () => {
      let sum = 0;
      const startBin = Math.floor((500 / (sampleRate / 2)) * binCount);
      const endBin = Math.floor((2000 / (sampleRate / 2)) * binCount);
      for (let i = startBin; i < endBin; i++) sum += frequencyData[i];
      return (sum / (endBin - startBin)) / 255; // Normalize to 0-1
    };
    
    const getHighEnergy = () => {
      let sum = 0;
      const startBin = Math.floor((2000 / (sampleRate / 2)) * binCount);
      for (let i = startBin; i < binCount; i++) sum += frequencyData[i];
      return (sum / (binCount - startBin)) / 255; // Normalize to 0-1
    };
    
    const low = getLowEnergy();
    const mid = getMidEnergy();
    const high = getHighEnergy();
    const total = low + mid + high;
    
    // DEBUG: Log frequency analysis MORE OFTEN to see what's happening
    if (Math.random() < 0.1) {
      console.log('🎤 Frequency analysis:', {
        low: low.toFixed(1),
        mid: mid.toFixed(1),
        high: high.toFixed(1),
        total: total.toFixed(1),
        threshold: 'checking if total < 0.1',
        isSpeaking: isSpeaking  // ADD THIS TO SEE THE STATE
      });
    }
    
    // MUCH LOWER threshold - if there's ANY audio energy, detect visemes
    if (total < 0.1) {
      console.log('⚠️ Total energy too low:', total.toFixed(3));
      return 'neutral';
    }
    
    // Calculate ratios
    const lowRatio = low / total;
    const midRatio = mid / total;
    const highRatio = high / total;
    
    // DEBUG: Log ratios and detection result
    let detectedViseme = 'neutral';
    
    // Vowel A - balanced mid and low
    if (midRatio > 0.4 && lowRatio > 0.3) {
      detectedViseme = 'A';
    }
    // Vowel E - mid-high dominant
    else if (midRatio > 0.45 && highRatio > 0.25) {
      detectedViseme = 'E';
    }
    // Vowel I - high frequencies
    else if (highRatio > 0.4) {
      detectedViseme = 'I';
    }
    // Vowel O - low dominant
    else if (lowRatio > 0.5) {
      detectedViseme = 'O';
    }
    // Vowel U - very low dominant
    else if (lowRatio > 0.6) {
      detectedViseme = 'U';
    }
    // Consonants
    else if (high > 80 && highRatio > 0.5) {
      detectedViseme = 'S';
    }
    else if (low > 60 && mid < 20) {
      detectedViseme = 'M';
    }
    
    // Log EVERY detection to see what's happening
    console.log('👄 Viseme detection:', {
      lowRatio: lowRatio.toFixed(2),
      midRatio: midRatio.toFixed(2),
      highRatio: highRatio.toFixed(2),
      detected: detectedViseme,
      low: low.toFixed(1),
      mid: mid.toFixed(1),
      high: high.toFixed(1)
    });
    
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
