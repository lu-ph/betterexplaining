import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface PDFCoverPreviewProps {
  file: File
}

export function PDFCoverPreview({ file }: PDFCoverPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isActive = true
    const objectUrl = URL.createObjectURL(file)
    const loadingTask = pdfjsLib.getDocument({ url: objectUrl })

    setIsLoading(true)
    setHasError(false)

    loadingTask.promise
      .then((pdf) => pdf.getPage(1))
      .then((page) => {
        if (!isActive) return

        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context)
          throw new Error("PDF cover canvas is unavailable")

        const viewport = page.getViewport({ scale: 1.2 })
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        return page.render({
          canvas,
          canvasContext: context,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
          viewport,
        }).promise
      })
      .then(() => {
        if (isActive) setIsLoading(false)
      })
      .catch((error) => {
        if (isActive) {
          console.error("Failed to render PDF cover:", error)
          setIsLoading(false)
          setHasError(true)
        }
      })

    return () => {
      isActive = false
      URL.revokeObjectURL(objectUrl)
      void loadingTask.destroy()
    }
  }, [file])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
        aria-label={`${file.name} 第 1 页封面`}
      />
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-xs text-neutral-500">
          正在加载封面...
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 px-6 text-center">
          <span className="text-xl font-bold font-serif text-red-400">PDF</span>
          <span className="text-xs text-neutral-500">封面预览失败</span>
        </div>
      )}
    </div>
  )
}
