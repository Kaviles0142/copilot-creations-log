-- Create debate_sessions table to track multi-figure debates
CREATE TABLE IF NOT EXISTS public.debate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  topic text NOT NULL,
  figure_ids text[] NOT NULL,
  figure_names text[] NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_turn integer NOT NULL DEFAULT 0,
  user_id uuid
);

-- Create debate_messages table to store debate conversation
CREATE TABLE IF NOT EXISTS public.debate_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_session_id uuid NOT NULL REFERENCES public.debate_sessions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  figure_id text NOT NULL,
  figure_name text NOT NULL,
  content text NOT NULL,
  turn_number integer NOT NULL,
  is_user_message boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for debate_sessions
CREATE POLICY "Anyone can view debate sessions"
  ON public.debate_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create debate sessions"
  ON public.debate_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update debate sessions"
  ON public.debate_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete debate sessions"
  ON public.debate_sessions FOR DELETE
  USING (true);

-- RLS Policies for debate_messages
CREATE POLICY "Anyone can view debate messages"
  ON public.debate_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create debate messages"
  ON public.debate_messages FOR INSERT
  WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX idx_debate_messages_session_id ON public.debate_messages(debate_session_id);
CREATE INDEX idx_debate_messages_turn_number ON public.debate_messages(turn_number);
CREATE INDEX idx_debate_sessions_status ON public.debate_sessions(status);