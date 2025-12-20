-- Create video_jobs table to track async video generation
CREATE TABLE public.video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'initiating',
  video_url TEXT,
  error TEXT,
  ditto_request_id TEXT,
  image_url TEXT,
  audio_url TEXT,
  figure_id TEXT,
  figure_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a public app)
CREATE POLICY "Anyone can view video jobs"
  ON public.video_jobs
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create video jobs"
  ON public.video_jobs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update video jobs"
  ON public.video_jobs
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete video jobs"
  ON public.video_jobs
  FOR DELETE
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status);
CREATE INDEX idx_video_jobs_ditto_request_id ON public.video_jobs(ditto_request_id);