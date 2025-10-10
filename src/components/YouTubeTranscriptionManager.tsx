import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { transcribeAudioUrl } from '@/utils/whisperTranscription';
import { Loader2, FileAudio, CheckCircle, XCircle } from 'lucide-react';

interface YouTubeTranscriptionManagerProps {
  videoId: string;
  videoTitle?: string;
  figureId?: string;
  figureName?: string;
}

export const YouTubeTranscriptionManager = ({
  videoId,
  videoTitle,
  figureId,
  figureName,
}: YouTubeTranscriptionManagerProps) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'extracting' | 'transcribing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startTranscription = async () => {
    try {
      setStatus('checking');
      setProgress(5);
      setProgressMessage('Checking for existing captions...');
      setErrorMessage(null);

      // Try caption-based transcription first
      const { data: captionData, error: captionError } = await supabase.functions.invoke(
        'youtube-transcribe',
        {
          body: { videoId, videoTitle, figureId, figureName }
        }
      );

      if (captionData?.success && captionData?.transcript) {
        setTranscript(captionData.transcript);
        setStatus('success');
        setProgress(100);
        setProgressMessage(captionData.cached ? 'Using cached captions' : 'Captions extracted successfully');
        toast.success('Video transcribed using captions!');
        return;
      }

      // Captions not available, use Whisper fallback
      console.log('No captions available, using Whisper fallback');
      setStatus('extracting');
      setProgress(10);
      setProgressMessage('Extracting audio from YouTube...');

      // Extract audio
      const { data: audioData, error: audioError } = await supabase.functions.invoke(
        'extract-youtube-audio',
        {
          body: { 
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            figureName: figureName || 'Unknown'
          }
        }
      );

      if (audioError || !audioData?.success) {
        throw new Error(audioError?.message || 'Failed to extract audio');
      }

      setProgress(30);
      setProgressMessage('Audio extracted, starting transcription...');
      setStatus('transcribing');

      // Transcribe with browser-based Whisper
      const transcribedText = await transcribeAudioUrl(
        audioData.audioUrl,
        (stage, prog) => {
          setProgressMessage(stage);
          if (prog !== undefined) {
            setProgress(30 + (prog * 0.7)); // Scale from 30-100
          }
        }
      );

      // Save to database
      const { error: saveError } = await supabase
        .from('youtube_transcripts')
        .upsert({
          video_id: videoId,
          figure_id: figureId,
          figure_name: figureName,
          video_title: videoTitle,
          transcript: transcribedText,
        });

      if (saveError) {
        console.error('Error saving transcript:', saveError);
        toast.error('Transcript created but failed to save to database');
      }

      setTranscript(transcribedText);
      setStatus('success');
      setProgress(100);
      setProgressMessage('Transcription complete!');
      toast.success('Video transcribed successfully with Whisper!');

    } catch (error) {
      console.error('Transcription error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error('Failed to transcribe video');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          YouTube Transcription
        </CardTitle>
        <CardDescription>
          Extract transcripts from YouTube videos (with automatic fallback to AI transcription)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <Button onClick={startTranscription} className="w-full">
            Start Transcription
          </Button>
        )}

        {(status === 'checking' || status === 'extracting' || status === 'transcribing') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{progressMessage}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{progressMessage}</span>
            </div>
            {transcript && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Transcript Preview:</p>
                <p className="text-sm line-clamp-4">{transcript}</p>
              </div>
            )}
            <Button 
              onClick={() => {
                setStatus('idle');
                setProgress(0);
                setTranscript(null);
              }} 
              variant="outline" 
              className="w-full mt-4"
            >
              Transcribe Another Video
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Transcription Failed</span>
            </div>
            {errorMessage && (
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            )}
            <Button 
              onClick={() => {
                setStatus('idle');
                setProgress(0);
                setErrorMessage(null);
              }} 
              variant="outline" 
              className="w-full mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>First tries to extract existing captions (fast, free)</li>
            <li>If no captions exist, extracts audio from YouTube</li>
            <li>Transcribes audio using browser-based Whisper AI (free, no API costs)</li>
            <li>Saves transcript to database for future use</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
