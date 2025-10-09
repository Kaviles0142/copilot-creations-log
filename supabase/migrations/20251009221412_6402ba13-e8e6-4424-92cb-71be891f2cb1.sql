-- Create table for caching YouTube transcripts
CREATE TABLE IF NOT EXISTS public.youtube_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  figure_id TEXT,
  figure_name TEXT,
  video_title TEXT,
  transcript TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.youtube_transcripts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read transcripts
CREATE POLICY "Anyone can view transcripts"
  ON public.youtube_transcripts
  FOR SELECT
  USING (true);

-- System can insert/update transcripts
CREATE POLICY "System can manage transcripts"
  ON public.youtube_transcripts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_youtube_transcripts_video_id ON public.youtube_transcripts(video_id);
CREATE INDEX idx_youtube_transcripts_figure_id ON public.youtube_transcripts(figure_id);
CREATE INDEX idx_youtube_transcripts_expires_at ON public.youtube_transcripts(expires_at);