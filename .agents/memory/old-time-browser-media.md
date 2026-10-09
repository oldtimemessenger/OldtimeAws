---
name: Old Time browser media limitations
description: Test-browser codec limits and MediaPipe's unexpected graphics requirement.
---

The automated Chromium browser may support WebM/Opus but not H.264/AAC MP4. Check `canPlayType` before treating fixture playback failure as an app regression.

**Why:** valid four-second MP4 fixtures failed in testing, while equivalent VP8/Opus WebM fixtures played and recorded correctly.

**How to apply:** use supported WebM fixtures for browser recording checks; do not remove ordinary MP4 support from the app because this test browser lacks the codec.

MediaPipe ImageSegmenter can require a WebGL graphics service even with its delegate set to CPU.

**Why:** the genuine CPU-delegate model failed with a missing GPU service in a browser without WebGL. A real TensorFlow CPU segmentation fallback avoids that requirement.

**How to apply:** preserve the no-WebGL fallback; “CPU delegate” alone does not prove graphics-independent inference.
