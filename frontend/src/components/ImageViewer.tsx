import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { FileToolbar } from "./FileToolbar"
import type { ViewerMode } from "./FileToolbar"
import type { FileViewerHandle } from "./FileViewer"

interface ImageViewerProps {
  files: File[]
  activeMode: ViewerMode
  availableModes: ViewerMode[]
  onModeChange: (mode: ViewerMode) => void
}

export const ImageViewer = forwardRef<FileViewerHandle, ImageViewerProps>(
  function ImageViewer(
    { files, activeMode, availableModes, onModeChange },
    ref,
  ) {
    const [imageIndex, setImageIndex] = useState(0)
    const [scale, setScale] = useState(1.2)
    const [imageUrls, setImageUrls] = useState<string[]>([])
    const previousFileCountRef = useRef(0)

    useEffect(() => {
      const urls = files.map((file) => URL.createObjectURL(file))
      setImageUrls(urls)

      return () => urls.forEach((url) => URL.revokeObjectURL(url))
    }, [files])

    useEffect(() => {
      const hasNewImages = files.length > previousFileCountRef.current
      previousFileCountRef.current = files.length
      setImageIndex((currentIndex) => {
        return hasNewImages
          ? Math.max(files.length - 1, 0)
          : Math.min(currentIndex, Math.max(files.length - 1, 0))
      })
    }, [files.length])

    const currentUrl = imageUrls[imageIndex]
    const [touchStartX, setTouchStartX] = useState<number | null>(null)
    const moveImage = (nextIndex: number) => {
      setImageIndex(Math.max(0, Math.min(nextIndex, files.length - 1)))
    }

    const handleTouchEnd = (touchEndX: number) => {
      if (touchStartX === null) return
      const distance = touchEndX - touchStartX
      if (Math.abs(distance) >= 40) {
        moveImage(imageIndex + (distance < 0 ? 1 : -1))
      }
      setTouchStartX(null)
    }

    useImperativeHandle(
      ref,
      () => ({
        loadFromBase64: () => undefined,
        scrollToPage: async (pageNum) => moveImage(pageNum - 1),
        jumpToPage: async (pageNum) => moveImage(pageNum - 1),
        nextPage: async () => moveImage(imageIndex + 1),
        previousPage: async () => moveImage(imageIndex - 1),
        getCurrentPage: () => imageIndex + 1,
        getCurrentViewBase64: () => "data:,",
      }),
      [imageIndex, files.length],
    )

    return (
      <div className="relative min-h-0 min-w-0 w-full h-full border-r border-white/5 bg-[#09090B] flex flex-col overflow-hidden">
        <FileToolbar
          mode={activeMode}
          availableModes={availableModes}
          scale={scale}
          pageNum={imageIndex + 1}
          totalPages={files.length}
          hasDocument={files.length > 0}
          onModeChange={onModeChange}
          onZoomOut={() => setScale((prev) => Math.max(0.6, prev - 0.2))}
          onZoomIn={() => setScale((prev) => Math.min(3, prev + 0.2))}
          onPreviousPage={() => moveImage(imageIndex - 1)}
          onNextPage={() => moveImage(imageIndex + 1)}
        />

        <div
          className="relative min-h-0 flex-1 overflow-hidden bg-[#09090B] flex items-center justify-center p-6 touch-pan-y"
          onTouchStart={(event) =>
            setTouchStartX(event.touches[0]?.clientX ?? null)
          }
          onTouchEnd={(event) =>
            handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
          }
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`图片 ${imageIndex + 1}`}
              className="h-auto w-auto max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
            />
          ) : (
            <p className="text-neutral-600">当前未解析到图片文件</p>
          )}
        </div>
      </div>
    )
  },
)
