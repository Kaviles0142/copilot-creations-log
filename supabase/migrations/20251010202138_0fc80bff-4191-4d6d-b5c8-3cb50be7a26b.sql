-- Create figure_metadata table to cache nationality and region data
CREATE TABLE IF NOT EXISTS public.figure_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  figure_id text NOT NULL UNIQUE,
  figure_name text NOT NULL,
  nationality text,
  region text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.figure_metadata ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read figure metadata
CREATE POLICY "Anyone can view figure metadata"
  ON public.figure_metadata
  FOR SELECT
  USING (true);

-- System can manage figure metadata
CREATE POLICY "System can manage figure metadata"
  ON public.figure_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_figure_metadata_figure_id ON public.figure_metadata(figure_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_figure_metadata_updated_at
  BEFORE UPDATE ON public.figure_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();