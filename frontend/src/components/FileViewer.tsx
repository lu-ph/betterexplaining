import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { ImageViewer } from "./ImageViewer"
import { PDFViewer } from "./PDFViewer"
import type { ViewerMode } from "./FileToolbar"

interface FileViewerProps {
  files: File[]
}

export interface FileViewerHandle {
  loadFromBase64: (buffer: string) => void
  scrollToPage: (pageNum: number) => Promise<void>
  jumpToPage: (pageNum: number) => Promise<void>
  nextPage: () => Promise<void>
  previousPage: () => Promise<void>
  getCurrentPage: () => number
  getCurrentViewBase64: () => string
}

export const FileViewer = forwardRef<FileViewerHandle, FileViewerProps>(
  function FileViewer({ files }, ref) {
    const pdfFile = files.find((file) => file.type === "application/pdf")
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))
    const previousImageCountRef = useRef(imageFiles.length)
    const availableModes: ViewerMode[] = [
      ...(pdfFile ? ["pdf" as const] : []),
      ...(imageFiles.length > 0 ? ["image" as const] : []),
    ]
    const [activeMode, setActiveMode] = useState<ViewerMode>(
      pdfFile ? "pdf" : "image",
    )
    const pdfViewerRef = useRef<FileViewerHandle>(null)
    const imageViewerRef = useRef<FileViewerHandle>(null)
    const activeViewer = () =>
      activeMode === "pdf" ? pdfViewerRef.current : imageViewerRef.current

    useEffect(() => {
      const hasNewImages = imageFiles.length > previousImageCountRef.current
      previousImageCountRef.current = imageFiles.length
      setActiveMode((currentMode) => {
        if (hasNewImages) return "image"
        return availableModes.includes(currentMode)
          ? currentMode
          : availableModes[0]
      })
    }, [pdfFile, imageFiles.length])

    useImperativeHandle(
      ref,
      () => ({
        loadFromBase64: (buffer) => activeViewer()?.loadFromBase64(buffer),
        scrollToPage: (pageNum) =>
          activeViewer()?.scrollToPage(pageNum) ?? Promise.resolve(),
        jumpToPage: (pageNum) =>
          activeViewer()?.jumpToPage(pageNum) ?? Promise.resolve(),
        nextPage: () => activeViewer()?.nextPage() ?? Promise.resolve(),
        previousPage: () => activeViewer()?.previousPage() ?? Promise.resolve(),
        getCurrentPage: () => activeViewer()?.getCurrentPage() ?? 1,
        getCurrentViewBase64: () =>
          activeViewer()?.getCurrentViewBase64() ?? "data:,",
      }),
      [activeMode],
    )

    const handleModeChange = (mode: ViewerMode) => {
      if (availableModes.includes(mode)) setActiveMode(mode)
    }

    return (
      <div className="relative min-h-0 min-w-0 w-1/2 h-full border-r border-white/5 bg-[#0e0e11] flex flex-col overflow-hidden">
        {activeMode === "pdf" && pdfFile ? (
          <PDFViewer
            ref={pdfViewerRef}
            file={pdfFile}
            activeMode={activeMode}
            availableModes={availableModes}
            onModeChange={handleModeChange}
          />
        ) : imageFiles.length > 0 ? (
          <ImageViewer
            ref={imageViewerRef}
            files={imageFiles}
            activeMode={activeMode}
            availableModes={availableModes}
            onModeChange={handleModeChange}
          />
        ) : null}
      </div>
    )
  },
)
