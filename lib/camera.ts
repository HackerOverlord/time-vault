/**
 * Camera helpers shared by PhotoCapture and VideoRecorder.
 */

export type Facing = "user" | "environment"

/**
 * Number of video input devices. Call after camera permission is granted:
 * before that, some browsers hide devices (or report a single placeholder).
 * Returns 0 if the browser can't enumerate devices.
 */
export async function countCameras(): Promise<number> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 0
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === "videoinput").length
  } catch {
    return 0
  }
}

export const otherFacing = (f: Facing): Facing => (f === "user" ? "environment" : "user")
