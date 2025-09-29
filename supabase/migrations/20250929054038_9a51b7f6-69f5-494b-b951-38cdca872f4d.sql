-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table to store historical voice clones
CREATE TABLE public.historical_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_id TEXT NOT NULL UNIQUE,
  voice_name TEXT NOT NULL,
  description TEXT,
  is_cloned BOOLEAN DEFAULT true,
  figure_id TEXT, -- Links to historical figure
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.historical_voices ENABLE ROW LEVEL SECURITY;

-- Create policies for historical voices (read-only for users)
CREATE POLICY "Anyone can view historical voices" 
ON public.historical_voices 
FOR SELECT 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_historical_voices_updated_at
BEFORE UPDATE ON public.historical_voices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some sample data for existing voices
INSERT INTO public.historical_voices (voice_id, voice_name, description, is_cloned, figure_id) VALUES
('5rAEJ3ntjdwPSijjydPl', 'Einstein Voice Library', 'Einstein voice from ElevenLabs library', false, 'albert-einstein'),
('DKCevyuNm5sbcmJ7NN8a', 'Carsten Beyreuther', 'German-accented voice suitable for Einstein', false, 'albert-einstein');