-- Add provider column to cloned_voices table for tracking voice service provider
ALTER TABLE public.cloned_voices 
ADD COLUMN provider text DEFAULT 'resemble';

-- Update existing JFK voice to use Coqui
UPDATE public.cloned_voices 
SET provider = 'coqui' 
WHERE figure_id = 'john-f-kennedy';