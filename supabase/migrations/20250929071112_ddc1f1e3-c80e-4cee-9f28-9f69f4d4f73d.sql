-- Delete existing JFK voice to force enhanced re-cloning
DELETE FROM cloned_voices 
WHERE figure_id = 'john-f-kennedy' 
AND voice_id = 'cloned_john_f._kennedy_1759127090692';