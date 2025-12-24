import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2 } from 'lucide-react';
import { useK2Animation } from '@/hooks/useK2Animation';

interface K2AnimatedAvatarProps {
  imageUrl: string | null;
  audioUrl: string | null;
  text: string | null;
  isLoading?: boolean;
  figureName?: string;
  figureId?: string;
  onAnimationEnd?: () => void;
  onAnimationReady?: (frames: any[]) => void;
  onAudioReady?: (audioUrl: string) => void;
  frameCount?: number;
}

const K2AnimatedAvatar = ({ 
  imageUrl, 
  audioUrl,
  text,
  isLoading, 
  figureName,
  figureId,
  onAnimationEnd,
  onAnimationReady,
  onAudioReady,
  frameCount = 5,
}: K2AnimatedAvatarProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const processedTextRef = useRef<string | null>(null);
  const [showStaticFallback, setShowStaticFallback] = useState(false);

  const { 
    generateAnimation, 
    frames,
    currentFrameUrl,
    isGenerating, 
    isPlaying,
    status,
    playAnimation,
    reset,
    error,
  } = useK2Animation({
    onAnimationReady: (generatedFrames) => {
      console.log('🎬 Animation ready with', generatedFrames.length, 'frames');
      onAnimationReady?.(generatedFrames);
    },
    onError: (error) => {
      console.error('❌ Animation generation failed:', error);
      setShowStaticFallback(true);
      // Fallback: play audio only with static image
      if (audioUrl && audioRef.current) {
        console.log('🔊 Falling back to audio-only playback');
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
      }
    },
    frameCount,
  });

  // Generate animation when we have image, audio, and text
  useEffect(() => {
    if (!imageUrl || !audioUrl || !text) {
      console.log('⏸️ Missing image, audio, or text');
      return;
    }

    // Prevent processing the same text multiple times
    if (processedTextRef.current === text) {
      console.log('⏭️ Already processed this text, skipping');
      return;
    }

    // Mark this text as processed
    processedTextRef.current = text;
    setShowStaticFallback(false);
    
    console.log('🎬 Starting K2 animation generation for:', figureName);
    console.log('📸 Image:', imageUrl.substring(0, 50) + '...');
    console.log('🎵 Audio:', audioUrl.substring(0, 50) + '...');
    console.log('📝 Text:', text.substring(0, 50) + '...');

    // Notify that audio is ready (for immediate playback if animation fails)
    onAudioReady?.(audioUrl);

    // Generate animated frames
    generateAnimation(imageUrl, text, figureId, figureName, audioUrl);
  }, [imageUrl, audioUrl, text, figureName, figureId, generateAnimation, onAudioReady]);

  // Handle audio ended for animation sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        console.log('🔊 Audio ended');
        onAnimationEnd?.();
      };
    }
  }, [onAnimationEnd]);

  // Reset on new figure
  useEffect(() => {
    if (figureId) {
      processedTextRef.current = null;
      setShowStaticFallback(false);
    }
  }, [figureId]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading portrait...</p>
        </div>
      </Card>
    );
  }

  // Show portrait with generating overlay
  if (isGenerating && imageUrl) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <img 
          src={imageUrl} 
          alt="Avatar" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-white" />
            <p className="text-sm text-white font-medium">Generating animation...</p>
            <p className="text-xs text-white/70">K2 + Nano Banana</p>
          </div>
        </div>
        {/* Hidden audio for fallback */}
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  if (!imageUrl) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No avatar selected</p>
      </Card>
    );
  }

  // Show animated frames if available
  if (frames.length > 0 && currentFrameUrl) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <img
          src={currentFrameUrl}
          alt="Animated Avatar"
          className="w-full h-full object-cover transition-opacity duration-100"
        />
        {isPlaying && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
        {/* Frame indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
          <span className="text-xs text-white/70">
            Frame {frames.findIndex(f => f.imageUrl === currentFrameUrl) + 1}/{frames.length}
          </span>
        </div>
        {/* Audio element for synced playback */}
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  // Fallback to static image (with audio if available)
  console.log('🖼️ Rendering STATIC IMAGE fallback');
  return (
    <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
      <img 
        src={imageUrl} 
        alt="Avatar" 
        className="w-full h-full object-cover"
      />
      {showStaticFallback && audioUrl && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs text-white">Audio only</span>
        </div>
      )}
      {/* Hidden audio for playback */}
      <audio ref={audioRef} hidden />
    </Card>
  );
};

export default K2AnimatedAvatar;
