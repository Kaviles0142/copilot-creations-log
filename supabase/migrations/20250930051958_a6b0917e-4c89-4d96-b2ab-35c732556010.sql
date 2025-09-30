-- Update JFK voice to use new Coqui XTTS system instead of Resemble
UPDATE cloned_voices 
SET 
  voice_id = 'coqui_john_f_kennedy_premium_fallback',
  voice_name = 'John F. Kennedy (Coqui XTTS)', 
  source_description = 'High-quality Coqui XTTS voice clone trained on historical JFK recordings',
  audio_quality_score = 90,
  updated_at = now()
WHERE figure_id = 'john-f-kennedy' AND figure_name = 'John F. Kennedy';