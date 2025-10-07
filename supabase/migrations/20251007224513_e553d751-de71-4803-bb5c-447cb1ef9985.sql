-- Remove all Coqui voice references from the database
-- This includes old coqui_ prefixed entries and invalid resemble entries

-- Delete all voices with coqui_ prefix in voice_id
DELETE FROM cloned_voices 
WHERE voice_id LIKE 'coqui_%';

-- Delete the invalid resemble entry that still has a coqui voice_id
DELETE FROM cloned_voices 
WHERE provider = 'resemble' 
  AND voice_id = 'coqui_premium_cleopatra';

-- Deactivate any resemble_fallback entries (they're outdated)
UPDATE cloned_voices 
SET is_active = false 
WHERE voice_name LIKE '%resemble_fallback%';