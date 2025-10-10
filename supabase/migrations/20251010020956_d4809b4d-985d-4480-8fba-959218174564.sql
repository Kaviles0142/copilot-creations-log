-- Create audio_cache table for TTS response caching
CREATE TABLE public.audio_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  cached_audio TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(text, voice_id)
);

-- Enable RLS
ALTER TABLE public.audio_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached audio
CREATE POLICY "Anyone can view cached audio"
ON public.audio_cache
FOR SELECT
USING (true);

-- System can manage cache
CREATE POLICY "System can manage audio cache"
ON public.audio_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_audio_cache_lookup ON public.audio_cache(text, voice_id);
CREATE INDEX idx_audio_cache_expires ON public.audio_cache(expires_at);