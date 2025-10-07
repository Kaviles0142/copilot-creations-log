-- Update Cleopatra's voice to use the new female FakeYou voice
UPDATE cloned_voices 
SET voice_id = 'weight_kprmcy9ws4r8zczbtyt6x5ede',
    updated_at = now()
WHERE figure_id = 'cleopatra' 
  AND voice_id = 'weight_cvwnagsfbb4v0fag8c84sqat1'
  AND provider = 'fakeyou';