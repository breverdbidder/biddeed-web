'use client'

import type { DeedAttachment } from './useDeedChat'

/**
 * Attachment limits, stated to the user BEFORE the picker opens rather than as
 * an error after the upload. An oversize file gets a message naming the limit
 * and the actual size — "Upload failed" is not an error message.
 */
export const MAX_FILES = 5
export const MAX_BYTES = 10 * 1024 * 1024
export const ACCEPTED =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/csv,text/plain,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ACCEPTED_SET = new Set(ACCEPTED.split(','))

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

let attachmentSeq = 0

export interface AddResult {
  accepted: DeedAttachment[]
  rejected: string[]
}

/**
 * One code path for three entrances: the + menu, paste, and drag-drop. Each
 * rejection carries the reason and the measured value.
 */
export function toAttachments(files: File[], existing: number): AddResult {
  const accepted: DeedAttachment[] = []
  const rejected: string[] = []
  let slots = MAX_FILES - existing

  for (const file of files) {
    if (slots <= 0) {
      rejected.push(`${file.name} — limit is ${MAX_FILES} files per message`)
      continue
    }
    if (file.size > MAX_BYTES) {
      rejected.push(
        `${file.name} — ${formatBytes(file.size)}, limit is ${formatBytes(MAX_BYTES)}`
      )
      continue
    }
    if (file.type && !ACCEPTED_SET.has(file.type)) {
      rejected.push(`${file.name} — ${file.type} is not an accepted type`)
      continue
    }
    slots -= 1
    accepted.push({
      id: `a${++attachmentSeq}`,
      name: file.name || 'untitled',
      size: file.size,
      type: file.type || 'application/octet-stream',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    })
  }
  return { accepted, rejected }
}

/**
 * Screen capture via getDisplayMedia, one frame, then the track is stopped.
 *
 * Stopping every track matters: leaving one live keeps the browser's "sharing
 * your screen" indicator on after a one-shot capture, which reads as spyware.
 * Returns null when the user dismisses the picker — a cancelled capture is not
 * an error and must not surface as one.
 */
export async function captureScreen(): Promise<File | null> {
  const media = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>
  }
  if (!media?.getDisplayMedia) throw new Error('This browser cannot capture the screen.')

  let stream: MediaStream
  try {
    stream = await media.getDisplayMedia({ video: true, audio: false })
  } catch (err) {
    if ((err as Error)?.name === 'NotAllowedError') return null
    throw err
  }

  try {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()
    // One rAF is not enough on every browser; wait for real frame data.
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) resolve()
      else video.onloadeddata = () => resolve()
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read the captured frame.')
    ctx.drawImage(video, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (!blob) throw new Error('Could not encode the captured frame.')
    return new File([blob], `screenshot-${canvas.width}x${canvas.height}.png`, {
      type: 'image/png',
    })
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}
