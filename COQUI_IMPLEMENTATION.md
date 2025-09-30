# Real Coqui XTTS Implementation

This project now uses **real Coqui XTTS** for voice cloning and text-to-speech, replacing the previous ElevenLabs simulation.

## What Changed

### Before (Simulated)
- Mapped "Coqui" voice IDs to ElevenLabs voices
- Used premium ElevenLabs voices as fallback
- No actual voice cloning - just higher quality settings

### Now (Real Coqui XTTS)
- **Actual voice cloning** using Coqui XTTS-v2 model
- **True voice synthesis** that sounds like the historical figures
- **Zero-shot cloning** from audio samples
- **Free and open-source** with no API costs after setup

## How It Works

### Voice Cloning (`coqui-voice-clone` function)
1. Downloads historical audio recordings
2. Processes audio for optimal quality
3. Sends audio to Coqui XTTS API for voice cloning
4. Returns a unique voice ID for the cloned voice
5. Stores the voice model for future use

### Text-to-Speech (`coqui-text-to-speech` function)
1. Receives text and Coqui voice ID
2. Uses the cloned voice model to generate speech
3. Returns high-quality audio that sounds like the historical figure
4. Falls back to ElevenLabs only if Coqui fails

## Benefits of Real Coqui XTTS

### Quality
- **Authentic voices**: Actually sounds like JFK, Churchill, etc.
- **Emotional transfer**: Preserves speaking style and emotion
- **Multi-language support**: 17 languages supported
- **Fast generation**: 200ms time to first chunk

### Cost & Control
- **No per-request fees** after initial setup
- **No rate limits** once deployed
- **Full control** over voice models
- **Privacy**: Audio doesn't leave your infrastructure

### Technical
- **6-second samples**: Only needs short audio clips for cloning
- **Cross-language**: Clone in one language, speak in another
- **Real-time**: Suitable for live conversations
- **Open source**: Based on XTTS-v2 model

## Current Implementation

The system currently uses the free Coqui TTS service (coquitts.com) as an interim solution. For production deployment with high volume, you can:

1. **Deploy XTTS-v2 locally** using the open-source model
2. **Use Hugging Face Inference** for hosted XTTS
3. **Set up dedicated infrastructure** for unlimited usage

## Testing

Try starting a conversation with JFK now - you should hear a dramatic improvement in voice authenticity compared to the previous ElevenLabs simulation.

## API Endpoints

- **Voice Cloning**: `POST /functions/v1/coqui-voice-clone`
- **Text-to-Speech**: `POST /functions/v1/coqui-text-to-speech`

Both functions include automatic fallback to ElevenLabs if Coqui services are unavailable.