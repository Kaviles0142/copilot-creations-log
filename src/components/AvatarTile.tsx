import { useRef, useState, useEffect, useCallback } from 'react';
import { useDittoStream } from '@/hooks/useDittoStream';
import { Badge } from '@/components/ui/badge';
import { Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarTileProps {
  figureName: string;
  figureId: string;
  avatarImageUrl: string | null;
  idleVideoUrl: string | null;
  isLoading?: boolean;
  isSpeaking?: boolean;
  audioPcm?: Float32Array | null;
  imageBase64?: string | null;
  className?: string;
  showStatusBadge?: boolean;
  onSpeakingEnd?: () => void;
}

export function AvatarTile({
  figureName,
  figureId,
  avatarImageUrl,
  idleVideoUrl,
  isLoading = false,
  isSpeaking = false,
  audioPcm = null,
  imageBase64 = null,
  className,
  showStatusBadge = true,
  onSpeakingEnd,
}: AvatarTileProps) {
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const hasStartedStreamRef = useRef(false);

  const {
    isStreaming,
    frameCount,
    canvasRef,
    startStream,
    stopStream,
    reset,
  } = useDittoStream({
    onError: (error) => {
      console.error('Stream error:', error);
      setStreamError(error.message);
      setIsLiveActive(false);
    },
    onComplete: () => {
      console.log('Stream complete');
      setIsLiveActive(false);
      hasStartedStreamRef.current = false;
      onSpeakingEnd?.();
    },
  });

  // Handle speaking state changes
  useEffect(() => {
    if (isSpeaking && audioPcm && imageBase64 && !hasStartedStreamRef.current) {
      hasStartedStreamRef.current = true;
      setIsLiveActive(true);
      setStreamError(null);
      
      console.log(`🎙️ Starting live stream for ${figureName}`);
      startStream(imageBase64, audioPcm).catch((err) => {
        console.error('Failed to start stream:', err);
        setIsLiveActive(false);
        hasStartedStreamRef.current = false;
      });
    } else if (!isSpeaking && isStreaming) {
      stopStream();
      setIsLiveActive(false);
      hasStartedStreamRef.current = false;
    }
  }, [isSpeaking, audioPcm, imageBase64, figureName, startStream, stopStream, isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Determine what to show
  const showLiveCanvas = isLiveActive && frameCount > 0;
  const showIdleVideo = !showLiveCanvas && idleVideoUrl;
  const showStaticImage = !showLiveCanvas && !showIdleVideo && avatarImageUrl;
  const showPlaceholder = !showLiveCanvas && !showIdleVideo && !showStaticImage && !isLoading;

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden transition-all duration-300",
        isSpeaking ? "ring-2 ring-primary" : "ring-1 ring-border",
        className
      )}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Idle Video Layer */}
      {idleVideoUrl && (
        <video
          ref={idleVideoRef}
          src={idleVideoUrl}
          loop
          autoPlay
          muted
          playsInline
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-150",
            showIdleVideo ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Static Image Layer (fallback) */}
      {avatarImageUrl && (
        <img
          src={avatarImageUrl}
          alt={figureName}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-150",
            showStaticImage ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Live Canvas Layer */}
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-150",
          showLiveCanvas ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Placeholder */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* CSS breathing animation for static image fallback */}
      {showStaticImage && !idleVideoUrl && (
        <div 
          className="absolute inset-0 bg-black/5 animate-pulse pointer-events-none"
          style={{ animationDuration: '3s' }}
        />
      )}

      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <span className="text-white font-medium text-sm">{figureName}</span>
      </div>

      {/* Status badge */}
      {showStatusBadge && (
        <div className="absolute top-2 right-2">
          {isLiveActive ? (
            <Badge variant="default" className="bg-primary text-primary-foreground text-xs animate-pulse">
              LIVE
            </Badge>
          ) : idleVideoUrl ? (
            <Badge variant="secondary" className="text-xs">
              IDLE
            </Badge>
          ) : streamError ? (
            <Badge variant="destructive" className="text-xs">
              ERROR
            </Badge>
          ) : null}
        </div>
      )}

      {/* Speaking indicator ring animation */}
      {isSpeaking && (
        <div className="absolute inset-0 border-2 border-primary rounded-xl animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
