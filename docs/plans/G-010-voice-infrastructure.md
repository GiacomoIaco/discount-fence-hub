# G-010: Universal Voice Recording Infrastructure
## Comprehensive Analysis & Implementation Plan

**Date:** December 2025
**Status:** Research Complete
**Complexity:** XL
**Importance:** 5/5

---

## Executive Summary

This document analyzes the current fragmented voice recording implementation across 5+ components and proposes a unified infrastructure based on 2025 best practices. Key recommendations include:

1. **Unified recording component** with context-aware configuration
2. **Client-side audio compression** using ffmpeg.wasm (50%+ size reduction)
3. **Hybrid transcription strategy** - Whisper for batch, optional real-time for specific use cases
4. **Smart storage tiers** with automatic cleanup policies

---

## Current State Analysis

### Fragmentation Map

| Component | Location | Recording | Transcription | AI Processing | Storage | Retention |
|-----------|----------|-----------|---------------|---------------|---------|-----------|
| AI Sales Coach | `ai-coach/SalesCoach.tsx` | Custom w/ timer, offline | Via Netlify function | `analyze-recording` | `recordings` table | Permanent |
| Request Form | `requests/RequestForm.tsx` | Custom, basic | `transcribeAudio()` | `parseVoiceTranscript` | None | Immediate delete |
| Roadmap Ideas | `roadmap/AddRoadmapItemModal.tsx` | Custom, basic timer | `transcribeAudio()` | `expandRoadmapIdea` | `voice-samples/temp/` | After processing |
| Voice Sample | `user-profile/VoiceSampleRecorder.tsx` | Custom, min/max limits | None | None | `voice-samples` | Permanent |
| Custom Pricing | `views/CustomPricingRequest.tsx` | Same as RequestForm | Same | Same | Same | Same |

### Current Problems

1. **Code Duplication**: ~500 lines of MediaRecorder logic duplicated across 5 files
2. **Inconsistent UX**: Different timer displays, playback controls, error handling
3. **No Compression**: Raw WebM files sent directly (10-min = ~10MB)
4. **No Playback Scrubbing**: Can't jump to specific timestamps
5. **No Speed Control**: Can't review at 1.5x/2x
6. **Hardcoded Limits**: No configurable time limits per context
7. **Chrome Seekability Bug**: WebM files without duration metadata can't seek

---

## 2025 Technology Landscape

### Recording Best Practices

**Codec Recommendation: Opus in WebM**
- All major browsers now support `audio/webm;codecs=opus`
- Optimal compression/quality ratio for speech
- Bitrate sweet spot: 32-64 kbps for voice (vs 128 kbps default)

**Chrome Duration Bug Fix**
Chrome produces WebM files without duration metadata, breaking seek functionality. Solutions:
1. Post-process with ffmpeg.wasm to add metadata
2. Use `opus-media-recorder` polyfill which handles this
3. Track duration manually and inject on playback

**Source:** [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [opus-media-recorder](https://github.com/kbumsik/opus-media-recorder)

### Client-Side Compression

**ffmpeg.audio.wasm** - Lightweight audio-focused build
- Only 5MB (vs 20MB full ffmpeg.wasm)
- Can compress 10-min WebM from ~10MB to ~2MB (32kbps Opus)
- Runs in Web Worker, doesn't block UI
- Transcription quality unaffected at 32kbps/12kHz

**Research Finding:** "Tinkering with format led to 50%+ response time optimization. Reducing quality below 32 kbps and 12 kHz showed no transcription accuracy benefit."

**Source:** [ffmpeg.audio.wasm](https://github.com/JorenSix/ffmpeg.audio.wasm), [Whisper Optimization](https://dev.to/mxro/optimise-openai-whisper-api-audio-format-sampling-rate-and-quality-29fj)

### Transcription Options

| Provider | Latency | Accuracy (WER) | Price | Best For |
|----------|---------|----------------|-------|----------|
| **OpenAI Whisper** | 2-10s batch | ~5% | $0.006/min | Batch processing, accuracy |
| **Deepgram Nova-3** | <300ms streaming | ~3% | $0.0043/min | Real-time, multilingual |
| **AssemblyAI** | ~300ms streaming | ~6% | $0.0042/min | Features (sentiment, PII) |

**Recommendation:** Stay with Whisper for batch (current use case). Consider Deepgram for future real-time features (live coaching feedback).

**Sources:** [AssemblyAI Comparison](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription), [Deepgram Pricing](https://deepgram.com/learn/speech-to-text-api-pricing-breakdown-2025)

### Storage & Retention

**Supabase Storage Limitations:**
- No native lifecycle policies (unlike AWS S3)
- Charged per total storage size
- Must implement custom cleanup

**Cleanup Strategies:**
1. **pg_cron** scheduled function to delete old files
2. **Edge Function** triggered on schedule
3. **Application-level** cleanup during user session

**Source:** [Supabase Storage Docs](https://supabase.com/docs/guides/storage)

---

## Proposed Architecture

### Component Structure

```
src/
├── components/
│   └── voice-recorder/
│       ├── VoiceRecorder.tsx        # Main unified component
│       ├── useVoiceRecorder.ts      # Recording logic hook
│       ├── AudioPlayer.tsx          # Playback with scrubbing/speed
│       ├── AudioCompressor.ts       # ffmpeg.wasm wrapper
│       ├── RecordingIndicator.tsx   # Visual feedback (waveform)
│       └── types.ts
│
├── lib/
│   └── audio/
│       ├── transcribe.ts            # Whisper API integration
│       ├── storage.ts               # Upload/download/cleanup
│       └── compress.ts              # Compression utilities
│
└── features/
    ├── ai-coach/      # <VoiceRecorder context="coach" maxMinutes={120} retain={true} />
    ├── requests/      # <VoiceRecorder context="request" maxMinutes={15} retain={false} />
    └── roadmap/       # <VoiceRecorder context="roadmap" maxMinutes={20} retain={false} />
```

### VoiceRecorder Component API

```tsx
interface VoiceRecorderProps {
  // Context & Configuration
  context: 'coach' | 'request' | 'roadmap' | 'sample';
  maxMinutes?: number;          // Default varies by context
  minSeconds?: number;          // Minimum valid recording

  // Storage & Retention
  retain?: boolean;             // Save to permanent storage
  retentionDays?: number;       // For retained recordings (default 180)

  // Callbacks
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  onTranscriptReady?: (text: string) => void;
  onProcessed?: (result: ProcessedAudio) => void;

  // UI Customization
  showWaveform?: boolean;
  showTimer?: boolean;
  compact?: boolean;            // Minimal UI for inline use

  // Processing Options
  autoTranscribe?: boolean;     // Transcribe immediately after recording
  compress?: boolean;           // Apply client-side compression
  compressionQuality?: 'high' | 'medium' | 'low';
}

// Context Defaults
const CONTEXT_DEFAULTS = {
  coach: { maxMinutes: 120, retain: true, showWaveform: true },
  request: { maxMinutes: 15, retain: false, autoTranscribe: true },
  roadmap: { maxMinutes: 20, retain: false, autoTranscribe: true },
  sample: { maxMinutes: 1.5, minSeconds: 10, retain: true },
};
```

### AudioPlayer Component

```tsx
interface AudioPlayerProps {
  src: string | Blob;
  duration?: number;            // If known (for seek bug workaround)

  // Playback Controls
  showScrubber?: boolean;       // Timeline with seek
  showSpeedControl?: boolean;   // 0.5x, 1x, 1.5x, 2x
  speeds?: number[];            // Custom speed options

  // Display
  showTimestamp?: boolean;
  showDuration?: boolean;
  compact?: boolean;
}
```

---

## Comparison: Current vs Proposed

### Development & Maintenance

| Aspect | Current | Proposed | Winner |
|--------|---------|----------|--------|
| **Lines of Code** | ~2,500 (duplicated) | ~800 (shared) | Proposed (-68%) |
| **Bug Fixes** | Apply to 5 files | Apply once | Proposed |
| **New Features** | Implement 5x | Implement once | Proposed |
| **Testing** | 5 test suites | 1 comprehensive | Proposed |
| **Learning Curve** | Different UX per hub | Consistent UX | Proposed |

### User Experience

| Feature | Current | Proposed |
|---------|---------|----------|
| **Timer Display** | Inconsistent | Standardized, prominent |
| **Waveform** | None | Real-time visualization |
| **Playback Scrubbing** | Not possible | Full timeline seek |
| **Speed Control** | None | 0.5x, 1x, 1.5x, 2x |
| **Recording Limits** | Hardcoded/none | Configurable per context |
| **Error Handling** | Varies | Consistent with retry |
| **Offline Support** | Only AI Coach | Universal (progressive) |

### Performance & Cost

| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| **10-min File Size** | ~10 MB | ~2 MB | -80% |
| **Upload Time** | ~8s (3G) | ~2s (3G) | -75% |
| **Transcription Cost** | $0.06/10min | $0.06/10min | Same |
| **Storage Cost** | 5x larger | 5x smaller | -80% |
| **Netlify Bandwidth** | High | Low | -80% |

### Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| **ffmpeg.wasm initial load** | Lazy load only when recording starts; cache in Service Worker |
| **Compression time** | Run in Web Worker; show progress; ~2s for 10-min |
| **Browser compatibility** | Feature detection; fallback to uncompressed |
| **Migration effort** | Phased rollout; adapter pattern for existing code |

---

## Implementation Phases

### Phase 1: Core Component (1-2 days)
- [ ] Create `VoiceRecorder` component with basic recording
- [ ] Create `useVoiceRecorder` hook with MediaRecorder logic
- [ ] Add configurable time limits
- [ ] Add prominent timer display
- [ ] Fix Chrome duration/seek bug

### Phase 2: Enhanced Playback (1 day)
- [ ] Create `AudioPlayer` component
- [ ] Implement timeline scrubbing
- [ ] Add speed control (0.5x-2x)
- [ ] Add duration display

### Phase 3: Compression (1 day)
- [ ] Integrate ffmpeg.audio.wasm
- [ ] Create compression worker
- [ ] Add progress indicator
- [ ] Implement quality presets

### Phase 4: Storage Integration (1 day)
- [ ] Unified upload to Supabase storage
- [ ] Signed URL generation
- [ ] Cleanup utilities
- [ ] Storage quota warnings

### Phase 5: Migrate Existing (2-3 days)
- [ ] Migrate Roadmap (simplest - delete after use)
- [ ] Migrate Requests (medium - similar flow)
- [ ] Migrate Voice Sample (simple - keep existing storage)
- [ ] Migrate AI Coach (complex - preserve all features)

### Phase 6: Retention & Cleanup (1 day)
- [ ] Create pg_cron job for old file cleanup
- [ ] Add storage usage display
- [ ] Implement archive/delete UI for users

---

## Decision Points Needing Input

1. **Compression Default**: Should compression be on by default?
   - Pro: Faster uploads, lower costs
   - Con: Slight delay after recording (2-3s for 10min)

2. **Offline-First Everywhere**: Should all contexts support offline?
   - Pro: Works in poor connectivity (yard, rural sites)
   - Con: Adds complexity, storage management

3. **Real-Time Transcription**: Add Deepgram for live feedback?
   - Pro: Immediate feedback, better UX
   - Con: Additional API cost, complexity

4. **Storage Location**: Single bucket vs per-context buckets?
   - Single: Simpler policies, easier cleanup
   - Multiple: Better organization, separate RLS

---

## Recommendation

Proceed with the unified architecture. The 68% code reduction, consistent UX, and 80% storage savings justify the migration effort. Start with Phases 1-3 (core functionality) before migrating existing components.

**Estimated Total Effort:** 7-10 days
**Estimated Monthly Savings:** Storage costs reduced 80%, bandwidth reduced 80%
**UX Impact:** Significantly improved with scrubbing, speed control, consistent experience

---

## Sources

- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [opus-media-recorder](https://github.com/kbumsik/opus-media-recorder)
- [ffmpeg.audio.wasm](https://github.com/JorenSix/ffmpeg.audio.wasm)
- [Whisper API Optimization](https://dev.to/mxro/optimise-openai-whisper-api-audio-format-sampling-rate-and-quality-29fj)
- [Long Audio Transcription](https://www.buildwithmatija.com/blog/building-a-long-audio-transcription-tool-with-openai-s-whisper-api)
- [AssemblyAI Real-Time Comparison](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
- [Deepgram Pricing 2025](https://deepgram.com/learn/speech-to-text-api-pricing-breakdown-2025)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
