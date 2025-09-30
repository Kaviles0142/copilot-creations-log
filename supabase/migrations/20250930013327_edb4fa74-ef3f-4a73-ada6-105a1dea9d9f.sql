-- Create policies for cloned_voices table that don't exist yet
DO $$
BEGIN
    -- Check if policies exist before creating them
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cloned_voices' 
        AND policyname = 'Anyone can create cloned voices'
    ) THEN
        CREATE POLICY "Anyone can create cloned voices" 
        ON public.cloned_voices 
        FOR INSERT 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cloned_voices' 
        AND policyname = 'Anyone can update cloned voices'
    ) THEN
        CREATE POLICY "Anyone can update cloned voices" 
        ON public.cloned_voices 
        FOR UPDATE 
        USING (true);
    END IF;
END
$$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_cloned_voices_figure_id ON public.cloned_voices(figure_id);
CREATE INDEX IF NOT EXISTS idx_cloned_voices_is_active ON public.cloned_voices(is_active);
CREATE INDEX IF NOT EXISTS idx_historical_voices_voice_id ON public.historical_voices(voice_id);

-- Fix the audio_quality_score default value (was 0, should be 75)
ALTER TABLE public.cloned_voices ALTER COLUMN audio_quality_score SET DEFAULT 75;