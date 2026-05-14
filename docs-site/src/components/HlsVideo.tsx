import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface Props {
  src: string
  className?: string
  fallbackMp4?: string
}

export default function HlsVideo ({ src, className = '', fallbackMp4 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Try HLS first
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false
        }
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // If HLS fails (CORS etc), fall back to MP4
        if (data.fatal && fallbackMp4) {
          hls.destroy()
          video.src = fallbackMp4
          video.play().catch(() => {})
        }
      })
      return () => { hls.destroy() }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src
      video.addEventListener('error', () => {
        if (fallbackMp4) {
          video.src = fallbackMp4
          video.play().catch(() => {})
        }
      })
      video.play().catch(() => {})
    } else if (fallbackMp4) {
      // No HLS support at all, use MP4
      video.src = fallbackMp4
      video.play().catch(() => {})
    }
  }, [src, fallbackMp4])

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className={className}
    />
  )
}
