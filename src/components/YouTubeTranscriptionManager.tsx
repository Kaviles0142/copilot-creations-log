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
    // DISABLED: YouTube transcription not currently in use
    toast.error('YouTube transcription is currently disabled');
    setStatus('error');
    setErrorMessage('YouTube integration is not active');
    return;
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
