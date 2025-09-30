import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Play, CheckCircle, XCircle, Clock, Download, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HistoricalFigure {
  id: string;
  name: string;
  period: string;
  description: string;
  avatar: string;
}

interface VoiceCloningPipelineProps {
  figure: HistoricalFigure;
}

interface PipelineStatus {
  id: string;
  status: string;
  current_step: number;
  youtube_videos?: any;
  raw_audio_files?: any;
  cleaned_audio_files?: any;
  model_path?: string;
  api_endpoint?: string;
  training_metrics?: any;
  error_log?: string;
  created_at: string;
  updated_at: string;
}

const stepNames = [
  'Initiation',
  'Audio Extraction & Filtering',
  'Audio Cleaning & Segmentation', 
  'Voice Model Training',
  'API Integration'
];

const statusColors = {
  'initiated': 'default',
  'extracting': 'secondary',
  'cleaning': 'secondary', 
  'training': 'secondary',
  'integrating': 'secondary',
  'completed': 'default',
  'failed': 'destructive'
} as const;

const statusIcons = {
  'initiated': <Clock className="h-4 w-4" />,
  'extracting': <Download className="h-4 w-4" />,
  'cleaning': <Loader2 className="h-4 w-4 animate-spin" />,
  'training': <Mic className="h-4 w-4" />,
  'integrating': <Loader2 className="h-4 w-4 animate-spin" />,
  'completed': <CheckCircle className="h-4 w-4" />,
  'failed': <XCircle className="h-4 w-4" />
};

export const VoiceCloningPipeline: React.FC<VoiceCloningPipelineProps> = ({ figure }) => {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const { toast } = useToast();

  // Check if pipeline already exists for this figure
  useEffect(() => {
    checkExistingPipeline();
  }, [figure.id]);

  // Poll for status updates when pipeline is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPolling && pipelineStatus?.id) {
      interval = setInterval(() => {
        pollPipelineStatus();
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, pipelineStatus?.id]);

  const checkExistingPipeline = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_training_pipeline')
        .select('*')
        .eq('figure_id', figure.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing pipeline:', error);
        return;
      }

      if (data) {
        setPipelineStatus(data);
        
        // Start polling if pipeline is in progress
        if (['initiated', 'extracting', 'cleaning', 'training', 'integrating'].includes(data.status)) {
          setIsPolling(true);
        }
      }
    } catch (error) {
      console.error('Error in checkExistingPipeline:', error);
    }
  };

  const pollPipelineStatus = async () => {
    if (!pipelineStatus?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('automated-voice-pipeline', {
        body: {
          figureId: figure.id,
          figureName: figure.name,
          action: 'get_status'
        }
      });

      if (error) {
        console.error('Error polling pipeline status:', error);
        return;
      }

      if (data.success && data.pipeline) {
        setPipelineStatus(data.pipeline);
        
        // Stop polling if completed or failed
        if (['completed', 'failed'].includes(data.pipeline.status)) {
          setIsPolling(false);
          
          if (data.pipeline.status === 'completed') {
            toast({
              title: "Voice Cloning Complete!",
              description: `Successfully created custom voice for ${figure.name}`,
            });
          } else {
            toast({
              title: "Voice Cloning Failed",
              description: data.pipeline.error_log || "An error occurred during processing",
              variant: "destructive"
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in pollPipelineStatus:', error);
    }
  };

  const startPipeline = async () => {
    setIsStarting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('automated-voice-pipeline', {
        body: {
          figureId: figure.id,
          figureName: figure.name,
          action: 'start_pipeline'
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Pipeline Started!",
          description: `Voice cloning pipeline initiated for ${figure.name}`,
        });
        
        // Start polling for updates
        setIsPolling(true);
        
        // Refresh status
        setTimeout(checkExistingPipeline, 1000);
      } else {
        throw new Error(data.message || 'Failed to start pipeline');
      }
    } catch (error) {
      console.error('Error starting pipeline:', error);
      toast({
        title: "Failed to Start Pipeline",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsStarting(false);
    }
  };

  const getProgressValue = () => {
    if (!pipelineStatus) return 0;
    
    const step = pipelineStatus.current_step;
    const status = pipelineStatus.status;
    
    if (status === 'completed') return 100;
    if (status === 'failed') return 0;
    
    // Calculate progress based on current step (1-4)
    return Math.max(0, Math.min(100, (step / 4) * 100));
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Custom Voice Training Pipeline
          <Badge variant="outline">{figure.name}</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!pipelineStatus ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Create a custom, high-quality voice clone for {figure.name} using the automated 4-step pipeline:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-500" />
                <span>Audio extraction from YouTube</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-green-500" />
                <span>Audio cleaning & segmentation</span>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-purple-500" />
                <span>RVC/OpenVoice model training</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-orange-500" />
                <span>Custom API integration</span>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is a demonstration pipeline that simulates the voice cloning process. 
                For production use, the audio extraction would require an external service to handle YouTube downloads.
              </p>
            </div>
            
            <Button 
              onClick={startPipeline} 
              disabled={isStarting}
              className="gap-2"
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start Voice Cloning Pipeline
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusIcons[pipelineStatus.status as keyof typeof statusIcons]}
                <Badge variant={statusColors[pipelineStatus.status as keyof typeof statusColors]}>
                  {pipelineStatus.status.charAt(0).toUpperCase() + pipelineStatus.status.slice(1)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Duration: {formatDuration(pipelineStatus.created_at)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(getProgressValue())}%</span>
              </div>
              <Progress value={getProgressValue()} className="h-2" />
            </div>

            {/* Current Step */}
            <div className="text-sm">
              <span className="font-medium">Current Step:</span>{' '}
              {stepNames[pipelineStatus.current_step] || 'Unknown'}
            </div>

            {/* Pipeline Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {pipelineStatus.youtube_videos && (
                <div>
                  <span className="font-medium">YouTube Videos:</span>{' '}
                  {pipelineStatus.youtube_videos.length} found
                </div>
              )}
              
              {pipelineStatus.raw_audio_files && (
                <div>
                  <span className="font-medium">Raw Audio:</span>{' '}
                  {pipelineStatus.raw_audio_files.length} files
                </div>
              )}
              
              {pipelineStatus.cleaned_audio_files && (
                <div>
                  <span className="font-medium">Cleaned Audio:</span>{' '}
                  {pipelineStatus.cleaned_audio_files.length} files
                </div>
              )}
              
              {pipelineStatus.model_path && (
                <div>
                  <span className="font-medium">Model:</span>{' '}
                  Trained & Ready
                </div>
              )}
            </div>

            {/* Training Metrics */}
            {pipelineStatus.training_metrics && (
              <div className="bg-muted p-3 rounded-lg">
                <h4 className="font-medium mb-2">Training Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div>Accuracy: {(pipelineStatus.training_metrics.accuracy * 100).toFixed(1)}%</div>
                  <div>Similarity: {(pipelineStatus.training_metrics.similarity_score * 100).toFixed(1)}%</div>
                  <div>Epochs: {pipelineStatus.training_metrics.epochs}</div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {pipelineStatus.status === 'failed' && pipelineStatus.error_log && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {pipelineStatus.error_log}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {pipelineStatus.status === 'completed' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Voice cloning completed successfully! The custom voice for {figure.name} is now available.
                  {pipelineStatus.api_endpoint && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      API Endpoint: {pipelineStatus.api_endpoint}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Restart Button */}
            {['completed', 'failed'].includes(pipelineStatus.status) && (
              <div className="pt-2">
                <Button 
                  onClick={startPipeline}
                  disabled={isStarting}
                  variant="outline"
                  className="gap-2"
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Restart Pipeline
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};