-- Create podcast_sessions table
CREATE TABLE IF NOT EXISTS public.podcast_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  topic TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  current_turn INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  language TEXT NOT NULL DEFAULT 'en',
  user_id UUID
);

-- Enable RLS
ALTER TABLE public.podcast_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for podcast_sessions
CREATE POLICY "Anyone can view podcast sessions"
  ON public.podcast_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create podcast sessions"
  ON public.podcast_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update podcast sessions"
  ON public.podcast_sessions
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete podcast sessions"
  ON public.podcast_sessions
  FOR DELETE
  USING (true);

-- Create podcast_messages table
CREATE TABLE IF NOT EXISTS public.podcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_session_id UUID NOT NULL REFERENCES public.podcast_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  turn_number INTEGER NOT NULL,
  speaker_role TEXT NOT NULL, -- 'host' or 'guest'
  content TEXT NOT NULL,
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.podcast_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for podcast_messages
CREATE POLICY "Anyone can view podcast messages"
  ON public.podcast_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create podcast messages"
  ON public.podcast_messages
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for both tables
ALTER TABLE public.podcast_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.podcast_messages REPLICA IDENTITY FULL;