-- Update Cleopatra's voice to use the new high-quality female FakeYou voice
UPDATE cloned_voices 
SET voice_id = 'weight_pf8y55rx5e3prbzhahxxn6qf1',
    updated_at = now()
WHERE figure_id = 'cleopatra' 
  AND provider = 'fakeyou';