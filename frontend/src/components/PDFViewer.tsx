import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { PDFPage } from "./PDFPage"
import { FileToolbar } from "./FileToolbar"
import type { ViewerMode } from "./FileToolbar"
import type { FileViewerHandle } from "./FileViewer"

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface PDFViewerProps {
  file: File
  activeMode: ViewerMode
  availableModes: ViewerMode[]
  onModeChange: (mode: ViewerMode) => void
}

export const PDFViewer = forwardRef<FileViewerHandle, PDFViewerProps>(
  function PDFViewer({ file, activeMode, availableModes, onModeChange }, ref) {
    // 状态管理
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [pageNum, setPageNum] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [scale, setScale] = useState(1.2) // 默认缩放倍率
    const pageNumRef = useRef(1)
    const totalPagesRef = useRef(0)
    const pdfScrollRef = useRef<HTMLDivElement>(null)
    const pageElementsRef = useRef(new Map<number, HTMLDivElement>())

    useEffect(() => {
      pageNumRef.current = pageNum
    }, [pageNum])

    useEffect(() => {
      totalPagesRef.current = totalPages
    }, [totalPages])

    const scrollToPage = async (nextPage: number) => {
      await goToPage(nextPage, "smooth")
    }

    const jumpToPage = async (nextPage: number) => {
      await goToPage(nextPage, "auto")
    }

    const goToPage = async (nextPage: number, behavior: ScrollBehavior) => {
      const targetPage = Math.max(
        1,
        Math.min(nextPage, totalPagesRef.current || nextPage),
      )
      setPageNum(targetPage)
      pageElementsRef.current.get(targetPage)?.scrollIntoView({
        behavior,
        block: "start",
      })
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
    }

    const getCurrentViewBase64 = () => {
      const canvas = pageElementsRef.current
        .get(pageNumRef.current)
        ?.querySelector("canvas")
      return canvas?.toDataURL("image/png") || "data:,"
    }

    useImperativeHandle(
      ref,
      () => ({
        loadFromBase64: () => undefined,
        scrollToPage,
        jumpToPage,
        nextPage: () => scrollToPage(pageNumRef.current + 1),
        previousPage: () => scrollToPage(pageNumRef.current - 1),
        getCurrentPage: () => pageNumRef.current,
        getCurrentViewBase64,
      }),
      [totalPages],
    )

    // Effect 1: 解析并加载 PDF 文档
    useEffect(() => {
      const objectUrl = URL.createObjectURL(file)
      const loadingTask = pdfjsLib.getDocument({ url: objectUrl })

      loadingTask.promise
        .then((doc) => {
          setPdfDoc(doc)
          setTotalPages(doc.numPages)
          setPageNum(1) // 重置到第一页
        })
        .catch((err) => {
          if (err?.name !== "AbortException") {
            console.error("Failed to load PDF:", err)
          }
        })

      return () => {
        URL.revokeObjectURL(objectUrl)
        // 销毁文档实例，释放内存
        loadingTask.destroy()
      }
    }, [file])

    // 控制器逻辑
    const handlePrev = () => void scrollToPage(pageNumRef.current - 1)
    const handleNext = () => void scrollToPage(pageNumRef.current + 1)
    const handleZoomIn = () => setScale((prev) => Math.min(3, prev + 0.2))
    const handleZoomOut = () => setScale((prev) => Math.max(0.6, prev - 0.2))

    return (
      <div className="relative min-h-0 min-w-0 w-full h-full bg-[#0e0e11] flex flex-col overflow-hidden">
        <FileToolbar
          mode={activeMode}
          availableModes={availableModes}
          scale={scale}
          pageNum={pageNum}
          totalPages={totalPages}
          hasDocument={Boolean(pdfDoc)}
          onModeChange={onModeChange}
          onZoomOut={handleZoomOut}
          onZoomIn={handleZoomIn}
          onPreviousPage={handlePrev}
          onNextPage={handleNext}
        />

        {/* PDF 渲染区域 */}
        <div
          ref={pdfScrollRef}
          className="absolute inset-0 min-h-0 bg-[#151518] flex flex-col overflow-auto custom-scrollbar"
        >
          <div className="w-full max-w-full flex flex-col items-center">
            {pdfDoc &&
              Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1
                return (
                  <PDFPage
                    key={pageNumber}
                    pdfDoc={pdfDoc}
                    pageNumber={pageNumber}
                    scale={scale}
                    containerRef={pdfScrollRef}
                    onVisible={setPageNum}
                    onElement={(number, element) => {
                      if (element) pageElementsRef.current.set(number, element)
                      else pageElementsRef.current.delete(number)
                    }}
                  />
                )
              })}
          </div>
        </div>
      </div>
    )
  },
)
