-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create table to log background job executions
CREATE TABLE IF NOT EXISTS public.data_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  figures_checked INTEGER NOT NULL DEFAULT 0,
  health_results JSONB,
  auto_fixes_applied INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.data_health_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view logs
CREATE POLICY "Anyone can view data health logs"
ON public.data_health_logs
FOR SELECT
USING (true);

-- Allow system to insert logs
CREATE POLICY "System can insert data health logs"
ON public.data_health_logs
FOR INSERT
WITH CHECK (true);

-- Schedule automated data checker to run every 6 hours
SELECT cron.schedule(
  'automated-data-checker',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
        url:='https://trclpvryrjlafacocbnd.supabase.co/functions/v1/automated-data-checker',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY2xwdnJ5cmpsYWZhY29jYm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDk5NTAsImV4cCI6MjA3NDY4NTk1MH0.noDkcnCcthJhY4WavgDDZYl__QtOq1Y9t9dTowrU2tc"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);