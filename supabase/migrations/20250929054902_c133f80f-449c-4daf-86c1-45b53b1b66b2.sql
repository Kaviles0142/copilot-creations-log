-- Add policies to allow auto-cloning system to create historical voices
CREATE POLICY "System can create historical voices" 
ON public.historical_voices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update historical voices" 
ON public.historical_voices 
FOR UPDATE 
USING (true);