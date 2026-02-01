
# Zoom-like Avatar Tiles with Idle Loop + Live Stream Swap

## Overview
Transform the avatar display into a Zoom-like call interface where each avatar tile always shows motion - either an idle loop video when not speaking, or live-streamed frames from the Ditto WebSocket when actively speaking.

## Current Architecture

### TestAvatars.tsx
- Generates static Einstein portrait via `generate-einstein-image` edge function
- Connects to Ditto WebSocket for real-time lip-sync streaming
- Renders frames on a `<canvas>` element
- Uses Azure TTS for audio generation
- WebSocket URL: `wss://b3x5whv066zofk-8000.proxy.runpod.net/` (new URL)

### Room.tsx
- Multi-participant Zoom-like layout with avatar tiles
- Generates static avatar portraits per figure
- Shows speaking indicator when figure is active
- Integrates with `RoomChat` for orchestration

### RealisticAvatar.tsx
- Displays static images with optional video overlay
- Handles video playback from pre-generated videos
- Supports audio-only fallback with speaking animations

## Implementation Plan

### Phase 1: Create Idle Video Generation System

**New Edge Function: `generate-idle-loop`**
- Takes an avatar image as input
- Generates a 3-5 second silent "breathing/idle" video using Ditto
- Uses minimal silent audio (just ambient) to create subtle motion
- Stores the generated idle MP4 in Supabase Storage
- Caches by figure_id to avoid regeneration

**Technical Details:**
- Input: Avatar image URL/base64
- Process: Send to Ditto with ~3 seconds of near-silent audio
- Output: MP4 URL stored in Supabase Storage
- Cache key: `idle-{figure_id}-{image_hash}`

### Phase 2: Create AvatarTile Component

**New Component: `AvatarTile.tsx`**
A unified tile component that handles both idle and speaking states.

```
Props:
- figureName: string
- figureId: string
- avatarImageUrl: string
- idleVideoUrl: string | null
- isSpeaking: boolean
- dittoWsUrl?: string
- liveAudioPcm?: Float32Array (for live streaming)
- onSpeakingEnd?: () => void
```

**Rendering Logic:**
```
if (isSpeaking && liveAudioPcm):
  - Render <canvas> with live Ditto frames
  - Show green "Speaking" indicator
else if (idleVideoUrl):
  - Render <video loop autoplay muted> with idle MP4
  - Seamless looping with subtle motion
else:
  - Fallback: static image with CSS breathing animation
```

**Key Features:**
- Pre-loads idle video on mount
- Maintains WebSocket connection for speaking mode
- Seamless transition: fade/crossfade between idle and live
- Canvas/video swap happens instantly, no flicker

### Phase 3: Create useDittoStream Hook

**New Hook: `useDittoStream.ts`**
Manages the WebSocket connection to Ditto for real-time streaming.

```
const { 
  isConnected,
  isStreaming,
  frameCount,
  canvasRef,
  startStream,   // (imageBase64, audioPcm) => void
  stopStream,    // () => void
  reset          // () => void
} = useDittoStream({
  wsUrl: "wss://b3x5whv066zofk-8000.proxy.runpod.net/ws/stream",
  onFrame: (frameBase64) => void,
  onError: (error) => void,
  onComplete: () => void
});
```

**Internal Logic:**
1. Connect to WebSocket
2. Send init message with avatar image
3. Stream audio chunks with [4,8,2] pattern
4. Receive frames and draw on canvas
5. Fire onComplete when done

### Phase 4: Update TestAvatars Page

**Modifications to `/test-avatars`:**
1. Generate idle video on avatar creation
2. Display idle loop by default
3. When "Stream" clicked:
   - Generate TTS audio
   - Convert to PCM
   - Swap to live canvas view
   - Stream audio chunks to Ditto
4. When stream ends:
   - Seamlessly swap back to idle loop

**New UI Layout:**
- Single large tile showing avatar
- Shows "IDLE" badge when looping
- Shows "LIVE" badge when streaming
- Smooth crossfade transition

### Phase 5: Integrate into Room.tsx

**Modifications:**
1. **Avatar Generation:**
   - When generating portrait, also trigger idle video generation
   - Store `idleVideoUrl` alongside `imageUrl` in `figureAvatars` map

2. **Tile Display:**
   - Replace static `<img>` with `<AvatarTile>` component
   - Pass `isSpeaking` from `speakingFigure` state
   - Pass `idleVideoUrl` from avatar data

3. **Speaking Integration:**
   - When RoomChat triggers TTS for a figure:
     - Convert audio to PCM
     - Pass to AvatarTile for live streaming
   - When audio/stream ends:
     - Resume idle loop

4. **State Flow:**
```
RoomChat speaks -> onSpeakingChange(true, figureName)
                -> AvatarTile receives isSpeaking=true
                -> Switch from idle video to live canvas
                -> Stream complete
                -> onSpeakingChange(false)
                -> Switch back to idle video
```

### Phase 6: useIdleVideoPreloader Hook

**New Hook: `useIdleVideoPreloader.ts`**
Manages idle video generation and caching.

```
const {
  getIdleVideoUrl,    // (figureId, imageUrl) => Promise<string>
  isGenerating,
  preloadIdleVideo,
  clearCache
} = useIdleVideoPreloader();
```

**Features:**
- Checks Supabase Storage for cached idle video
- If not cached, calls `generate-idle-loop` edge function
- Returns URL immediately if cached
- Queues generation if multiple figures requested

---

## Technical Considerations

### Seamless Video Swap
To prevent flicker when switching between idle loop and live stream:
1. Keep both elements in DOM
2. Use opacity transitions (0.1s fade)
3. Pre-init WebSocket before speaking starts (if possible)

### WebSocket URL Configuration
The Ditto WebSocket URL (`wss://b3x5whv066zofk-8000.proxy.runpod.net/ws/stream`) should be stored as an environment variable for easy updates when the RunPod pod changes.

### Audio-Video Sync
For live streaming:
- Audio must be converted to Float32 PCM 16kHz
- Sent in chunks with [4,8,2] pattern
- Small delay (250ms) between chunk sends

### Fallback Behavior
If idle video generation fails or WebSocket disconnects:
- Fall back to static image with CSS breathing animation
- Show warning toast
- Continue to function without motion

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/AvatarTile.tsx` | Main tile component with idle/live switching |
| `src/hooks/useDittoStream.ts` | WebSocket streaming hook |
| `src/hooks/useIdleVideoPreloader.ts` | Idle video generation/caching hook |
| `supabase/functions/generate-idle-loop/index.ts` | Edge function for idle video generation |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/TestAvatars.tsx` | Replace canvas with AvatarTile, add idle loop support |
| `src/pages/Room.tsx` | Replace static images with AvatarTile components |
| `src/components/RealisticAvatar.tsx` | Potentially deprecate or refactor |

---

## Data Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AVATAR TILE LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────┐    │
│  │ Generate     │───>│ Generate Idle    │───>│ Display Idle Loop      │    │
│  │ Portrait     │    │ Video (3-5s)     │    │ <video loop autoplay>  │    │
│  └──────────────┘    └──────────────────┘    └───────────┬────────────┘    │
│                                                          │                  │
│                           User Sends Message             │                  │
│                                  │                       │                  │
│                                  v                       │                  │
│                      ┌──────────────────────┐            │                  │
│                      │ Generate TTS Audio   │            │                  │
│                      │ (Azure TTS)          │            │                  │
│                      └──────────┬───────────┘            │                  │
│                                 │                        │                  │
│                                 v                        │                  │
│                      ┌──────────────────────┐            │                  │
│                      │ Convert to PCM 16kHz │            │                  │
│                      │ Float32 format       │            │                  │
│                      └──────────┬───────────┘            │                  │
│                                 │                        │                  │
│            isSpeaking=true      │                        │                  │
│                                 v                        v                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     SEAMLESS SWAP (opacity fade)                      │  │
│  │                                                                       │  │
│  │   ┌─────────────────┐              ┌─────────────────────────────┐   │  │
│  │   │ Idle Video      │   ─────>     │ Live Canvas                 │   │  │
│  │   │ (fade out)      │              │ (Ditto WS frames, fade in)  │   │  │
│  │   └─────────────────┘              └─────────────────────────────┘   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                           │
│                                 │ Stream audio chunks                       │
│                                 v                                           │
│                      ┌──────────────────────┐                              │
│                      │ Ditto WebSocket      │                              │
│                      │ Receive JPEG frames  │                              │
│                      │ Draw on canvas       │                              │
│                      └──────────┬───────────┘                              │
│                                 │                                           │
│                                 │ Stream complete                           │
│            isSpeaking=false     │                                           │
│                                 v                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     SEAMLESS SWAP BACK                                │  │
│  │                                                                       │  │
│  │   ┌─────────────────────────────┐         ┌────────────────────────┐ │  │
│  │   │ Live Canvas                 │  ────>  │ Idle Video Loop        │ │  │
│  │   │ (fade out)                  │         │ (resume, fade in)      │ │  │
│  │   └─────────────────────────────┘         └────────────────────────┘ │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Create `generate-idle-loop` edge function** - Generate idle videos via Ditto
2. **Create `useDittoStream` hook** - Extract WebSocket logic from TestAvatars
3. **Create `AvatarTile` component** - Unified tile with idle/live switching
4. **Update `TestAvatars.tsx`** - Test the new system end-to-end
5. **Create `useIdleVideoPreloader` hook** - Manage caching
6. **Update `Room.tsx`** - Replace static images with AvatarTile

This approach ensures we can test each piece incrementally before integrating into the main Room experience.
