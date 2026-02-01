'use client'

import { useRef, useState, useCallback } from 'react'

interface PhotoCaptureProps {
  onCapture: (imageBase64: string, mimeType: string) => void
  disabled?: boolean
}

const MAX_DIMENSION = 1500
const JPEG_QUALITY = 0.8

/**
 * Resize and compress an image file using Canvas API.
 * Returns base64 data (without data URI prefix) and mime type.
 */
function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Scale down if either dimension exceeds max
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Always output as JPEG for consistent compression
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      // Strip "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1]

      resolve({ base64, mimeType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

export function PhotoCapture({ onCapture, disabled }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [compressing, setCompressing] = useState(false)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCompressing(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      onCapture(base64, mimeType)
    } catch (err) {
      console.error('Image compression error:', err)
    } finally {
      setCompressing(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [onCapture])

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || compressing}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || compressing}
        className="w-full border border-dashed border-slate-700 hover:border-open-green rounded-lg py-4 px-4 text-slate-400 hover:text-open-green font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {compressing ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-open-green rounded-full animate-spin" />
            Compressing...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Identify from Photo
          </>
        )}
      </button>
    </div>
  )
}
