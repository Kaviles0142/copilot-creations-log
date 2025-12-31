import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

interface RealisticAvatarProps {
  imageUrl: string | null;
  isLoading?: boolean;
  audioUrl?: string | null;
  videoUrl?: string | null;
  isGeneratingVideo?: boolean;
  isSpeaking?: boolean;
  figureName?: string;
  figureId?: string;
  videoChunkProgress?: { current: number; total: number } | null;
  allVideoUrls?: string[]; // All video chunks for replay
  isLoadingNextChunk?: boolean; // Loading indicator between chunks
  onVideoEnd?: () => void;
  onAudioEnd?: () => void;
}

const RealisticAvatar = ({ 
  imageUrl, 
  isLoading, 
  audioUrl,
  videoUrl,
  isGeneratingVideo,
  isSpeaking: externalIsSpeaking,
  figureName,
  figureId,
  videoChunkProgress,
  allVideoUrls = [],
  isLoadingNextChunk = false,
  onVideoEnd,
  onAudioEnd,
}: RealisticAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAudioUrlRef = useRef<string | null>(null);
  const lastReceivedVideoUrlRef = useRef<string | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [lastVideoUrls, setLastVideoUrls] = useState<string[]>([]); // All chunks for replay
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState(0); // Current chunk during replay
  const [isReplaying, setIsReplaying] = useState(false);

  const isSpeaking = externalIsSpeaking || isPlayingAudio || isPlayingVideo;

  // Track all video URLs for replay (clears automatically between turns)
  useEffect(() => {
    setLastVideoUrls(allVideoUrls);

    if (allVideoUrls.length > 0) {
      console.log(`📹 Stored ${allVideoUrls.length} video chunks for replay`);
    }
  }, [allVideoUrls]);

  // Fetch last successful videos for this figure from database (fallback only)
  // IMPORTANT: Do not override in-progress/current-turn chunk lists.
  useEffect(() => {
    if (!figureId) return;
    if (isGeneratingVideo) return;
    if (allVideoUrls.length > 0) return;

    const fetchLastVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('video_jobs')
          .select('video_url')
          .eq('figure_id', figureId)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data?.length > 0) {
          const urls = data.map(d => d.video_url).filter(Boolean) as string[];
          console.log(`📹 Found ${urls.length} previous videos for figure`);

          // Use functional update to avoid overwriting newer in-session turn videos
          setLastVideoUrls(prev => (prev.length > 0 ? prev : urls.reverse()));
        }
      } catch {
        console.log('No previous videos found for figure');
      }
    };

    fetchLastVideos();
  }, [figureId, isGeneratingVideo, allVideoUrls.length]);

  // Timer for video generation
  useEffect(() => {
    if (isGeneratingVideo && !videoUrl) {
      setLoadingSeconds(0);
      loadingTimerRef.current = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
    
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [isGeneratingVideo, videoUrl]);

  // Play audio when audioUrl changes
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;
    
    // Don't replay same audio
    if (lastAudioUrlRef.current === audioUrl) return;
    lastAudioUrlRef.current = audioUrl;

    console.log('🎤 Playing audio with static avatar');
    audioRef.current.src = audioUrl;
    audioRef.current.load();
    
    const handlePlay = () => setIsPlayingAudio(true);
    const handleEnded = () => {
      setIsPlayingAudio(false);
      onAudioEnd?.();
    };
    const handleError = () => {
      setIsPlayingAudio(false);
      console.error('Audio playback error');
    };

    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);

    audioRef.current.play().catch(err => {
      console.error('Audio autoplay failed:', err);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
      }
    };
  }, [audioUrl, onAudioEnd]);

  // Play video when URL is available - only if not currently playing
  useEffect(() => {
    if (videoUrl && videoUrl !== lastReceivedVideoUrlRef.current) {
      // Only set new video if we're not already playing (or if it's a completely new URL)
      if (!isPlayingVideo || !activeVideoUrl) {
        lastReceivedVideoUrlRef.current = videoUrl;
        setActiveVideoUrl(videoUrl);
        setIsReplaying(false);
        console.log('🎬 New video URL received:', videoUrl.substring(0, 50) + '...');
      }
    }
  }, [videoUrl, isPlayingVideo, activeVideoUrl]);

  // Handle video playback when activeVideoUrl changes
  useEffect(() => {
    if (videoRef.current && activeVideoUrl && !videoError) {
      console.log('🎬 Loading video:', activeVideoUrl.substring(0, 60) + '...');
      videoRef.current.src = activeVideoUrl;
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.error('❌ Video autoplay failed:', err);
        setVideoError(true);
      });
    }
  }, [activeVideoUrl, videoError]);

  // Reset state when figure changes
  useEffect(() => {
    console.log('🔄 Figure changed, resetting avatar state');
    setVideoError(false);
    lastAudioUrlRef.current = null;
    lastReceivedVideoUrlRef.current = null;
    setIsPlayingAudio(false);
    setIsPlayingVideo(false);
    setLoadingSeconds(0);
    setActiveVideoUrl(null);
    setLastVideoUrls([]);
    setReplayIndex(0);
    setIsReplaying(false);
  }, [figureId]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlayingVideo) {
      videoRef.current.pause();
      setIsPlayingVideo(false);
    } else {
      videoRef.current.play().catch(console.error);
      setIsPlayingVideo(true);
    }
  };

  // Replay all video chunks sequentially
  const handleReplayLastVideo = () => {
    if (lastVideoUrls.length === 0) return;
    setVideoError(false);
    setIsReplaying(true);
    setReplayIndex(0);
    setActiveVideoUrl(lastVideoUrls[0]);
    console.log(`🔄 Starting replay: chunk 1/${lastVideoUrls.length}`);
  };

  // Handle video end - play next chunk during replay
  const handleVideoEnded = () => {
    console.log('⏹️ Video ended');
    setIsPlayingVideo(false);
    
    if (isReplaying && replayIndex < lastVideoUrls.length - 1) {
      // Play next chunk in replay sequence
      const nextIndex = replayIndex + 1;
      setReplayIndex(nextIndex);
      setActiveVideoUrl(lastVideoUrls[nextIndex]);
      console.log(`🔄 Replay: chunk ${nextIndex + 1}/${lastVideoUrls.length}`);
    } else {
      // End of replay or normal playback
      setActiveVideoUrl(null);
      setIsReplaying(false);
      setReplayIndex(0);
      onVideoEnd?.();
    }
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(console.error);
    setIsPlayingVideo(true);
  };

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

  if (!imageUrl) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">No avatar selected</p>
      </Card>
    );
  }

  // Show generating overlay while video generates with timer and chunk progress
  if (isGeneratingVideo && !videoUrl) {
    return (
      <Card className={`w-full max-w-md mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
        <img 
          src={imageUrl} 
          alt={figureName || 'Avatar'} 
          className={`w-full h-full object-cover ${isSpeaking ? 'animate-speaking-pulse' : ''}`}
        />
        {isSpeaking && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 px-3 py-2 rounded">
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <div className="text-right">
            <span className="text-xs text-white/70 block">
              {videoChunkProgress 
                ? `Generating chunk ${videoChunkProgress.current}/${videoChunkProgress.total}...` 
                : 'Generating video...'}
            </span>
            <span className="text-sm text-white font-bold">{loadingSeconds}s</span>
          </div>
        </div>
        <audio ref={audioRef} hidden />
      </Card>
    );
  }

  // Show video if available and no error with controls
  if (activeVideoUrl && !videoError) {
    return (
      <Card className="w-full max-w-md mx-auto aspect-square overflow-hidden relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          controls={false}
          className="w-full h-full object-cover"
          onPlay={() => {
            console.log('▶️ Video playing');
            setIsPlayingVideo(true);
          }}
          onEnded={handleVideoEnded}
          onError={(e) => {
            console.error('❌ Video playback error:', e);
            setVideoError(true);
            setActiveVideoUrl(null);
            setIsReplaying(false);
          }}
        />
        {/* Loading indicator for next chunk */}
        {isLoadingNextChunk && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 px-3 py-2 rounded">
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span className="text-xs text-white">Loading next...</span>
          </div>
        )}
        {/* Replay progress indicator */}
        {isReplaying && lastVideoUrls.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded">
            <span className="text-xs text-white">
              Chunk {replayIndex + 1}/{lastVideoUrls.length}
            </span>
          </div>
        )}
        {/* Video controls in corner */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handleReplay}
            title="Replay"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handlePlayPause}
            title={isPlayingVideo ? "Pause" : "Play"}
          >
            {isPlayingVideo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {isPlayingVideo && (
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded ml-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-white">Speaking</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Static image with audio playback - apply speaking animation
  return (
    <Card className={`w-full max-w-md mx-auto aspect-square overflow-hidden relative ${isSpeaking ? 'animate-speaking-glow' : ''}`}>
      <img 
        src={imageUrl} 
        alt={figureName || 'Avatar'} 
        className={`w-full h-full object-cover transition-all duration-300 ${isSpeaking ? 'animate-speaking-pulse' : ''}`}
      />
      {isSpeaking && (
        <>
          {/* Animated sound waves overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1 bg-primary/60 rounded-full"
                  style={{
                    height: `${8 + Math.sin((Date.now() / 150) + i) * 8}px`,
                    animation: `speaking-pulse ${0.3 + i * 0.1}s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Speaking</span>
          </div>
        </>
      )}
      {/* Replay button when there are previous videos */}
      {lastVideoUrls.length > 0 && !isSpeaking && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={handleReplayLastVideo}
            title={`Replay ${lastVideoUrls.length} video chunk${lastVideoUrls.length > 1 ? 's' : ''}`}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {lastVideoUrls.length > 1 && (
            <span className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">
              {lastVideoUrls.length}
            </span>
          )}
        </div>
      )}
      <audio ref={audioRef} hidden />
      {/* Hidden video element for replay functionality */}
      <video ref={videoRef} hidden />
    </Card>
  );
};

export default RealisticAvatar;
