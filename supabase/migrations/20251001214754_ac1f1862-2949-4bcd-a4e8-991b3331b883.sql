-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to cache SerpAPI results
CREATE TABLE IF NOT EXISTS public.serpapi_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL,
  search_type TEXT NOT NULL, -- 'news', 'context', 'articles'
  query TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '6 hours')
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_serpapi_cache_figure_type ON public.serpapi_cache(figure_id, search_type, expires_at);

-- Enable RLS
ALTER TABLE public.serpapi_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached results
CREATE POLICY "Anyone can view cached results" ON public.serpapi_cache
  FOR SELECT USING (true);

-- System can insert/update cache
CREATE POLICY "System can manage cache" ON public.serpapi_cache
  FOR ALL USING (true);

-- Schedule background refresh every 6 hours for popular figures
SELECT cron.schedule(
  'refresh-serpapi-cache',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT net.http_post(
    url:='https://trclpvryrjlafacocbnd.supabase.co/functions/v1/background-serpapi-refresh',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY2xwdnJ5cmpsYWZhY29jYm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDk5NTAsImV4cCI6MjA3NDY4NTk1MH0.noDkcnCcthJhY4WavgDDZYl__QtOq1Y9t9dTowrU2tc"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);