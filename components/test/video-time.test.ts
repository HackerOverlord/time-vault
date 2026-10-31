import { describe, it, expect, vi } from "vitest"
import { formatTime, resolveVideoDuration } from "@/lib/videoTime"

describe("formatTime", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatTime(0)).toBe("00:00")
    expect(formatTime(4.9)).toBe("00:04")
    expect(formatTime(75)).toBe("01:15")
  })

  it("renders unknown durations as --:-- instead of Infinity:NaN", () => {
    expect(formatTime(Infinity)).toBe("--:--")
    expect(formatTime(NaN)).toBe("--:--")
    expect(formatTime(-1)).toBe("--:--")
  })
})

/** Minimal fake <video> whose duration we control. */
function fakeVideo(initialDuration: number, readyState = 0) {
  const el = document.createElement("video")
  let duration = initialDuration
  let currentTime = 0
  let paused = true
  Object.defineProperty(el, "duration", { get: () => duration })
  Object.defineProperty(el, "readyState", { get: () => readyState })
  Object.defineProperty(el, "paused", { get: () => paused })
  Object.defineProperty(el, "currentTime", {
    get: () => currentTime,
    set: (v: number) => { currentTime = v },
  })
  el.play = vi.fn(() => { paused = false; return Promise.resolve() })
  return {
    el,
    setDuration: (d: number) => { duration = d; el.dispatchEvent(new Event("durationchange")) },
    setPaused: (p: boolean) => { paused = p },
  }
}

describe("resolveVideoDuration", () => {
  it("reports a normal finite duration directly", () => {
    const { el } = fakeVideo(12)
    const onDuration = vi.fn()
    resolveVideoDuration(el, onDuration)
    el.dispatchEvent(new Event("loadedmetadata"))
    expect(onDuration).toHaveBeenCalledWith(12)
    expect(el.currentTime).toBe(0)
  })

  it("resolves Infinity duration by seeking to the end, then rewinds", () => {
    const { el, setDuration } = fakeVideo(Infinity)
    const onDuration = vi.fn()
    resolveVideoDuration(el, onDuration)
    el.dispatchEvent(new Event("loadedmetadata"))
    expect(el.currentTime).toBeGreaterThan(1e6)   // seeked far past the end
    expect(onDuration).not.toHaveBeenCalled()

    setDuration(4.2)
    expect(onDuration).toHaveBeenCalledWith(4.2)
    expect(el.currentTime).toBe(0)                // rewound
  })

  it("resumes playback after resolving if the video was playing", () => {
    const { el, setDuration, setPaused } = fakeVideo(Infinity)
    resolveVideoDuration(el, vi.fn())
    setPaused(false)
    el.dispatchEvent(new Event("loadedmetadata"))
    setPaused(true)                               // seeking to the end fires "ended"
    setDuration(3)
    expect(el.play).toHaveBeenCalled()
  })

  it("handles metadata that loaded before listeners were attached", () => {
    const { el } = fakeVideo(8, 1)
    const onDuration = vi.fn()
    resolveVideoDuration(el, onDuration)
    expect(onDuration).toHaveBeenCalledWith(8)
  })

  it("cleanup removes listeners", () => {
    const { el, setDuration } = fakeVideo(Infinity)
    const onDuration = vi.fn()
    const cleanup = resolveVideoDuration(el, onDuration)
    cleanup()
    setDuration(5)
    expect(onDuration).not.toHaveBeenCalled()
  })
})

import { localISODate } from "@/lib/countdown"

describe("localISODate", () => {
  it("uses the local calendar date, not UTC", () => {
    // 9 PM local on Oct 30 — in UTC-4 this is already Oct 31 in UTC.
    const evening = new Date(2026, 9, 30, 21, 0, 0)
    expect(localISODate(0, evening)).toBe("2026-10-30")
    expect(localISODate(1, evening)).toBe("2026-10-31")
  })

  it("rolls over months and years", () => {
    expect(localISODate(1, new Date(2026, 11, 31, 12))).toBe("2027-01-01")
  })
})
