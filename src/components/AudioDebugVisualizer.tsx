import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface AudioDebugVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioDebugVisualizer = ({ analyser, isPlaying }: AudioDebugVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Calculate average amplitude
      const sum = dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / bufferLength;

      // Clear canvas
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Color based on frequency intensity
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      // Draw average amplitude indicator
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.fillRect(0, 0, canvas.width, 3);
      ctx.fillRect(0, 0, (average / 255) * canvas.width, 3);

      // Display numerical data
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = '12px monospace';
      ctx.fillText(`Avg: ${average.toFixed(2)}`, 10, 20);
      ctx.fillText(`Max: ${Math.max(...dataArray)}`, 10, 35);
      ctx.fillText(`Playing: ${isPlaying ? 'YES' : 'NO'}`, 10, 50);
      ctx.fillText(`Analyser: ${analyser ? 'CONNECTED' : 'NULL'}`, 10, 65);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">🔍 Audio Analyser Debug</h3>
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full border border-border rounded"
        />
        <p className="text-xs text-muted-foreground">
          If you see colored bars moving when audio plays, the analyser is working. 
          If bars stay flat at zero, the analyser isn't receiving audio data.
        </p>
      </div>
    </Card>
  );
};

export default AudioDebugVisualizer;
