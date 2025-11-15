-- Add current_round column to debate_sessions
ALTER TABLE public.debate_sessions 
ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 1;

-- Add is_round_complete to track if all figures have spoken in current round
ALTER TABLE public.debate_sessions 
ADD COLUMN IF NOT EXISTS is_round_complete BOOLEAN NOT NULL DEFAULT false;