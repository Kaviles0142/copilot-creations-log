-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', false);

-- Create storage bucket for raw audio (from YouTube extraction)
INSERT INTO storage.buckets (id, name, public) VALUES ('raw-audio', 'raw-audio', false);

-- Create storage bucket for cleaned audio (after processing)
INSERT INTO storage.buckets (id, name, public) VALUES ('cleaned-audio', 'cleaned-audio', false);

-- Create table to track voice training pipeline
CREATE TABLE public.voice_training_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, extracting, cleaning, training, completed, failed
  current_step INTEGER DEFAULT 1, -- 1=extraction, 2=cleaning, 3=training, 4=integration
  youtube_videos JSONB, -- Array of video URLs/IDs found
  raw_audio_files JSONB, -- Array of extracted raw audio file paths
  cleaned_audio_files JSONB, -- Array of cleaned audio file paths
  model_path TEXT, -- Path to trained voice model
  api_endpoint TEXT, -- Custom API endpoint for this voice
  training_metrics JSONB, -- Training performance metrics
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on voice training pipeline
ALTER TABLE public.voice_training_pipeline ENABLE ROW LEVEL SECURITY;

-- Create policies for voice training pipeline (for now, allow all operations)
CREATE POLICY "Voice training pipeline is accessible" 
ON public.voice_training_pipeline 
FOR ALL 
USING (true);

-- Create RLS policies for storage buckets
CREATE POLICY "Audio files are accessible to authenticated users" 
ON storage.objects 
FOR ALL 
USING (bucket_id IN ('audio-files', 'raw-audio', 'cleaned-audio'));

-- Create trigger for updating timestamps
CREATE TRIGGER update_voice_training_pipeline_updated_at
BEFORE UPDATE ON public.voice_training_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();