/**
 * Front/back camera switching in VideoRecorder and PhotoCapture.
 * getUserMedia / enumerateDevices / MediaRecorder are stubbed (jsdom has none).
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoRecorder } from '@/components/upload/video-recorder'
import { PhotoCapture } from '@/components/upload/photo-capture'

function fakeStream() {
  const track = { stop: vi.fn(), kind: 'video' }
  return { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] } as unknown as MediaStream
}

function stubDevices(cameraCount: number) {
  const getUserMedia = vi.fn(async () => fakeStream())
  const enumerateDevices = vi.fn(async () =>
    Array.from({ length: cameraCount }, (_, i) => ({ kind: 'videoinput', deviceId: `cam${i}` })))
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia, enumerateDevices },
  })
  return { getUserMedia }
}

class FakeRecorder {
  state = 'inactive'
  mimeType = 'video/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  static isTypeSupported = () => true
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.onstop?.() }
}

const facingOf = (call: unknown[]) =>
  ((call[0] as MediaStreamConstraints).video as MediaTrackConstraints).facingMode

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const recorderProps = { onUseVideo: vi.fn(), onSwitchToFile: vi.fn(), onCleanupRef: vi.fn() }

describe('VideoRecorder — camera switching', () => {
  it('starts on the front (selfie) camera and switches to the back one', async () => {
    const { getUserMedia } = stubDevices(2)
    const user = userEvent.setup()
    render(<VideoRecorder {...recorderProps} />)
    await user.click(screen.getByRole('button', { name: /record video/i }))

    expect(facingOf(getUserMedia.mock.calls[0])).toEqual({ ideal: 'user' })
    await user.click(await screen.findByRole('button', { name: /switch to back camera/i }))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    expect(facingOf(getUserMedia.mock.calls[1])).toEqual({ ideal: 'environment' })
    expect(await screen.findByRole('button', { name: /switch to front camera/i })).toBeInTheDocument()
  })

  it('hides the switch button on single-camera devices', async () => {
    stubDevices(1)
    const user = userEvent.setup()
    render(<VideoRecorder {...recorderProps} />)
    await user.click(screen.getByRole('button', { name: /record video/i }))
    await screen.findByRole('button', { name: /start recording/i })
    await new Promise(r => setTimeout(r, 0))   // let the camera count resolve
    expect(screen.queryByRole('button', { name: /switch to/i })).not.toBeInTheDocument()
  })

  it('hides the switch button while recording', async () => {
    stubDevices(2)
    const user = userEvent.setup()
    render(<VideoRecorder {...recorderProps} />)
    await user.click(screen.getByRole('button', { name: /record video/i }))
    await screen.findByRole('button', { name: /switch to back camera/i })

    await user.click(screen.getByRole('button', { name: /start recording/i }))
    expect(screen.queryByRole('button', { name: /switch to/i })).not.toBeInTheDocument()
  })
})

describe('PhotoCapture — camera switching', () => {
  const photoProps = { onUsePhoto: vi.fn(), onSwitchToFile: vi.fn(), onCleanupRef: vi.fn() }

  it('shows the switch button with 2 cameras', async () => {
    stubDevices(2)
    const user = userEvent.setup()
    render(<PhotoCapture {...photoProps} />)
    await user.click(screen.getByRole('button', { name: /take photo/i }))
    expect(await screen.findByRole('button', { name: /switch camera/i })).toBeInTheDocument()
  })

  it('hides it with only 1 camera', async () => {
    stubDevices(1)
    const user = userEvent.setup()
    render(<PhotoCapture {...photoProps} />)
    await user.click(screen.getByRole('button', { name: /take photo/i }))
    await screen.findByRole('button', { name: /capture photo/i })
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: /switch camera/i })).not.toBeInTheDocument()
  })
})

// ── Recording flow: live preview + "Use video" ───────────────────────────────

class DataRecorder extends FakeRecorder {
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['frame'], { type: 'video/webm' }) })
    this.onstop?.()
  }
}

describe('VideoRecorder — recording flow', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', DataRecorder)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:review'), revokeObjectURL: vi.fn() })
    // The production CSP blocks fetch() of blob: URLs; simulate that.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Refused to connect (CSP)'))))
  })

  it('shows the live camera in the preview on first open (and while recording)', async () => {
    stubDevices(1)
    const user = userEvent.setup()
    render(<VideoRecorder {...recorderProps} />)
    await user.click(screen.getByRole('button', { name: /record video/i }))
    const preview = await screen.findByLabelText(/live camera preview/i) as HTMLVideoElement
    expect(preview.srcObject).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /start recording/i }))
    expect((screen.getByLabelText(/live camera preview/i) as HTMLVideoElement).srcObject).not.toBeNull()
  })

  it('"Use video" hands the recording to the parent without fetching the blob: URL', async () => {
    stubDevices(1)
    const onUseVideo = vi.fn()
    const user = userEvent.setup()
    render(<VideoRecorder {...recorderProps} onUseVideo={onUseVideo} />)
    await user.click(screen.getByRole('button', { name: /record video/i }))
    await user.click(await screen.findByRole('button', { name: /start recording/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    await user.click(await screen.findByRole('button', { name: /use recorded video/i }))
    expect(onUseVideo).toHaveBeenCalledTimes(1)
    const file = onUseVideo.mock.calls[0][0] as File
    expect(file).toBeInstanceOf(File)
    expect(file.type).toMatch(/^video\//)
    expect(file.size).toBeGreaterThan(0)
    expect(fetch).not.toHaveBeenCalled()
  })
})
