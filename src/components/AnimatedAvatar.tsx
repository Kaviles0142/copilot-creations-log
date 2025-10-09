import { useEffect, useState } from "react";
import { HistoricalFigure } from "./HistoricalChat";
import { cn } from "@/lib/utils";

interface AnimatedAvatarProps {
  figure: HistoricalFigure;
  isSpeaking?: boolean;
  isLoading?: boolean;
}

const AnimatedAvatar = ({ figure, isSpeaking = false, isLoading = false }: AnimatedAvatarProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-8 transition-all duration-700 ease-out",
        isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"
      )}
    >
      {/* Animated glow ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-2xl transition-all duration-1000",
          isSpeaking
            ? "bg-primary/30 scale-110 animate-pulse"
            : "bg-primary/10 scale-100"
        )}
      />

      {/* Outer rotating ring */}
      <div
        className={cn(
          "absolute w-48 h-48 rounded-full border-2 border-primary/20 transition-all duration-500",
          isSpeaking && "animate-spin [animation-duration:8s]"
        )}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary/50 rounded-full" />
      </div>

      {/* Main avatar container */}
      <div
        className={cn(
          "relative w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 via-background to-primary/10 p-1 transition-all duration-500",
          isSpeaking && "scale-105 shadow-2xl shadow-primary/30"
        )}
      >
        {/* Inner avatar circle */}
        <div className="w-full h-full rounded-full bg-card border-2 border-primary/30 flex items-center justify-center overflow-hidden">
          {/* Avatar image placeholder - using emoji for now */}
          <div className="text-6xl">{figure.avatar}</div>
          
          {/* Pulse wave overlay when speaking */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping [animation-duration:1s]" />
              <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping [animation-duration:1.5s] [animation-delay:0.3s]" />
            </>
          )}
        </div>

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full rounded-full border-4 border-transparent border-t-primary animate-spin" />
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <h3 className="text-xl font-semibold text-foreground">{figure.name}</h3>
        <p className="text-sm text-muted-foreground">{figure.period}</p>
        
        {/* Voice activity indicator */}
        {isSpeaking && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-primary rounded-full animate-[wave_1s_ease-in-out_infinite]" />
              <div className="w-1 h-6 bg-primary rounded-full animate-[wave_1s_ease-in-out_infinite_0.2s]" />
              <div className="w-1 h-4 bg-primary rounded-full animate-[wave_1s_ease-in-out_infinite_0.4s]" />
              <div className="w-1 h-6 bg-primary rounded-full animate-[wave_1s_ease-in-out_infinite_0.6s]" />
              <div className="w-1 h-4 bg-primary rounded-full animate-[wave_1s_ease-in-out_infinite_0.8s]" />
            </div>
            <span className="text-xs text-primary font-medium">Speaking...</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
            <span className="text-xs text-muted-foreground">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimatedAvatar;
