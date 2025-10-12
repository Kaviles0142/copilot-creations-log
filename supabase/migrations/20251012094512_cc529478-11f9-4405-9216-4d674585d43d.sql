-- Create avatar image cache table
CREATE TABLE IF NOT EXISTS public.avatar_image_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_id TEXT NOT NULL UNIQUE,
  figure_name TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  visual_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.avatar_image_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached images
CREATE POLICY "Anyone can view cached avatar images"
  ON public.avatar_image_cache
  FOR SELECT
  USING (true);

-- Allow system to manage cache
CREATE POLICY "System can manage avatar image cache"
  ON public.avatar_image_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_avatar_cache_figure_id ON public.avatar_image_cache(figure_id);
CREATE INDEX idx_avatar_cache_expires_at ON public.avatar_image_cache(expires_at);