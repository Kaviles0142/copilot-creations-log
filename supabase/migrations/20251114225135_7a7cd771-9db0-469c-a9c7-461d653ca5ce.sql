-- Add format column to debate_sessions table
ALTER TABLE public.debate_sessions 
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'round-robin';

-- Add check constraint for valid formats
ALTER TABLE public.debate_sessions 
ADD CONSTRAINT valid_debate_format 
CHECK (format IN ('round-robin', 'free-for-all', 'moderated'));