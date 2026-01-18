import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface LiveVideoOverlayProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  topic?: string;
  children: React.ReactNode;
}

export default function LiveVideoOverlay({ 
  isPlaying, 
  isPaused, 
  onPause, 
  onResume, 
  topic,
  children 
}: LiveVideoOverlayProps) {
  const [isHovered, setIsHovered] = useState(false);

  const showControls = isHovered || isPaused;

  return (
    <div 
      className="relative w-full h-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main content (image/video) */}
      {children}

      {/* Overlay gradient on hover */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Top bar with LIVE badge */}
      <div 
        className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* LIVE badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide ${
            isPlaying && !isPaused 
              ? 'bg-red-600 text-white' 
              : 'bg-gray-600 text-gray-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isPlaying && !isPaused ? 'bg-white animate-pulse' : 'bg-gray-400'
            }`} />
            {isPaused ? 'PAUSED' : 'LIVE'}
          </div>
          
          {/* Viewer count simulation */}
          <span className="text-white/70 text-sm">
            Streaming
          </span>
        </div>
      </div>

      {/* Bottom bar with controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Play/Pause button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
            onClick={isPaused ? onResume : onPause}
          >
            {isPaused ? (
              <Play className="w-6 h-6 fill-white" />
            ) : (
              <Pause className="w-6 h-6 fill-white" />
            )}
          </Button>

          {/* Progress bar (visual only - shows live) */}
          <div className="flex-1">
            <div className="relative h-1 bg-white/30 rounded-full overflow-hidden">
              <div className={`absolute inset-y-0 left-0 bg-red-500 rounded-full transition-all duration-500 ${
                isPaused ? 'w-1/2' : 'w-full'
              }`} />
              {/* Live indicator dot */}
              {!isPaused && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
            </div>
            
            {/* Topic */}
            {topic && (
              <p className="text-white text-sm mt-2 truncate">
                {topic}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center play button when paused */}
      {isPaused && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-20 w-20 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-transform hover:scale-110"
            onClick={onResume}
          >
            <Play className="w-10 h-10 fill-white" />
          </Button>
        </div>
      )}
    </div>
  );
}
