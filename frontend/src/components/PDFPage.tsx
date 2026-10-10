import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"

export interface PDFPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  scale: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onVisible: (pageNumber: number) => void
  onElement: (pageNumber: number, element: HTMLDivElement | null) => void
}

export function PDFPage({
  pdfDoc,
  pageNumber,
  scale,
  containerRef,
  onVisible,
  onElement,
}: PDFPageProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState(pageNumber === 1)
  const [pageSize, setPageSize] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    const pageElement = pageRef.current
    const root = containerRef.current
    if (!pageElement || !root) return

    const lazyObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { root, rootMargin: "800px 0px", threshold: 0 },
    )
    const currentPageObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(pageNumber)
      },
      { root, threshold: 0.5 },
    )

    lazyObserver.observe(pageElement)
    currentPageObserver.observe(pageElement)
    return () => {
      lazyObserver.disconnect()
      currentPageObserver.disconnect()
    }
  }, [containerRef, onVisible, pageNumber])

  useEffect(() => {
    if (!isVisible) return

    let isActive = true
    let renderTask: pdfjsLib.RenderTask | null = null

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        if (!isActive) return

        setPageSize({ width: viewport.width, height: viewport.height })
        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context) return

        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = "100%"
        canvas.style.height = "auto"

        renderTask = page.render({
          canvas,
          canvasContext: context,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
          viewport,
        })
        await renderTask.promise
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error(`Failed to render PDF page ${pageNumber}:`, error)
        }
      }
    }

    renderPage()
    return () => {
      isActive = false
      renderTask?.cancel()
    }
  }, [isVisible, pageNumber, pdfDoc, scale])

  return (
    <div
      ref={(element) => {
        pageRef.current = element
        onElement(pageNumber, element)
      }}
      className="w-full max-w-full shrink-0"
      style={{
        aspectRatio: pageSize
          ? `${pageSize.width} / ${pageSize.height}`
          : "8.5 / 11",
      }}
    >
      <canvas ref={canvasRef} className="block w-full max-w-full h-auto" />
    </div>
  )
}
