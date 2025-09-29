-- Create table for storing cloned voices
CREATE TABLE IF NOT EXISTS public.cloned_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL,
  voice_id TEXT NOT NULL UNIQUE,
  voice_name TEXT NOT NULL,
  source_url TEXT,
  source_description TEXT,
  audio_quality_score INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since this is for historical figures)
CREATE POLICY "Cloned voices are publicly readable" 
ON public.cloned_voices 
FOR SELECT 
USING (true);

-- Create policy for service role to manage voices
CREATE POLICY "Service role can manage cloned voices" 
ON public.cloned_voices 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_cloned_voices_updated_at
BEFORE UPDATE ON public.cloned_voices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cloned_voices_figure_id ON public.cloned_voices(figure_id);
CREATE INDEX IF NOT EXISTS idx_cloned_voices_active ON public.cloned_voices(is_active);