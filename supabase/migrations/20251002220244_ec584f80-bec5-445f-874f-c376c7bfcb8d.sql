-- Create a table to cache current events/news
CREATE TABLE IF NOT EXISTS public.news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  news_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_news_cache_key ON public.news_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_news_cache_expires ON public.news_cache(expires_at);

-- Enable RLS (but allow all access since this is public news data)
ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to read news cache"
  ON public.news_cache
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role to manage news cache"
  ON public.news_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Clean up expired cache entries automatically
CREATE OR REPLACE FUNCTION public.cleanup_expired_news_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.news_cache WHERE expires_at < now();
END;
$$;