/**
 * Helpers for <video> elements playing browser-recorded WebM files.
 *
 * MediaRecorder writes WebM without a duration header, so Chrome reports
 * `video.duration === Infinity` until the whole file has been read. That
 * breaks timestamps ("Infinity:NaN") and percentage-based progress bars.
 */

/** Format seconds as mm:ss. Non-finite or negative values render as "--:--". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--"
  const s = Math.floor(seconds)
  const mm = Math.floor(s / 60).toString().padStart(2, "0")
  const ss = (s % 60).toString().padStart(2, "0")
  return `${mm}:${ss}`
}

/**
 * Make the browser resolve the real duration of a WebM with no duration header.
 *
 * Seeking far past the end forces the browser to scan the file; once it fires
 * `durationchange` with a finite value we seek back to the start and resume
 * playback if it was playing. Calls `onDuration` with the finite duration.
 *
 * Returns a cleanup function that removes the listeners.
 */
export function resolveVideoDuration(
  el: HTMLVideoElement,
  onDuration: (seconds: number) => void,
): () => void {
  let fixing = false
  let resumeAfterFix = false

  const report = () => {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return
    onDuration(el.duration)
    if (fixing) {
      fixing = false
      el.currentTime = 0
      if (resumeAfterFix) el.play().catch(() => {})
    }
  }

  const onLoadedMetadata = () => {
    if (el.duration === Infinity) {
      fixing = true
      resumeAfterFix = !el.paused
      el.currentTime = Number.MAX_SAFE_INTEGER
    } else {
      report()
    }
  }

  el.addEventListener("loadedmetadata", onLoadedMetadata)
  el.addEventListener("durationchange", report)
  // Metadata may already be loaded before we attached (cached / fast load).
  if (el.readyState >= 1) onLoadedMetadata()

  return () => {
    el.removeEventListener("loadedmetadata", onLoadedMetadata)
    el.removeEventListener("durationchange", report)
  }
}
