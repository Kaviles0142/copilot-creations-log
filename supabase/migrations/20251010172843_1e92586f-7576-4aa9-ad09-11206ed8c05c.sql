-- Clean up all fallback voice entries from cloned_voices table
-- These should never have been stored in the database

-- Delete Resemble fallback entries
DELETE FROM public.cloned_voices 
WHERE provider = 'resemble_fallback';

-- Delete Resemble marketplace fallback entries (specific voice IDs)
DELETE FROM public.cloned_voices 
WHERE provider = 'resemble_marketplace' 
AND voice_id IN ('TM7xETwE', 'ZQe5CJNj', 'Q2n6p3jW', 'bVMeCyTH');

-- Delete FakeYou fallback entries (specific voice IDs)
DELETE FROM public.cloned_voices 
WHERE provider = 'fakeyou' 
AND voice_id IN (
  'TM:v71tw06g2z0q',  -- Male fallback 1
  'TM:8dhkkkjwtdbp',  -- Male fallback 2
  'TM:qx2p3wzn5m5q',  -- Female fallback 1
  'TM:m7q4bxne406n'   -- Female fallback 2
);

-- Delete any generic/test fallback entries
DELETE FROM public.cloned_voices 
WHERE voice_name ILIKE '%fallback%' 
OR voice_name ILIKE '%test%'
OR voice_name ILIKE '%default%';