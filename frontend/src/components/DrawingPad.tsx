import { getStroke } from "perfect-freehand"
import { useEffect, useRef, useState } from "react"

const DRAWING_WITH_PEN_CLASS = "drawing-with-pen"
const BACKGROUND_COLOR = "#fffaf0"
const STROKE_COLOR = "#25231f"
const STROKE_SIZE = 4

interface DrawingPoint {
  x: number
  y: number
  pressure: number
}

interface DrawingPadProps {
  disabled: boolean
  isVisible: boolean
  onSend: (image: string) => Promise<void>
  onClose: () => void
}

const drawOutline = (
  context: CanvasRenderingContext2D,
  outline: number[][],
  width: number,
  height: number,
) => {
  if (outline.length === 0) return

  context.beginPath()
  context.moveTo(outline[0][0] * width, outline[0][1] * height)
  for (const [x, y] of outline.slice(1)) {
    context.lineTo(x * width, y * height)
  }
  context.closePath()
  context.fill()
}

export function DrawingPad({
  disabled,
  isVisible,
  onSend,
  onClose,
}: DrawingPadProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const finalizedOutlinesRef = useRef<number[][][]>([])
  const activeStrokeRef = useRef<DrawingPoint[] | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const canvasSizeRef = useRef({ width: 0, height: 0, pixelRatio: 1 })
  const disabledRef = useRef(disabled)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  disabledRef.current = disabled || isSending

  useEffect(() => {
    if (!isVisible) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !container || !context) return

    let canvasBounds = canvas.getBoundingClientRect()

    const setCanvasTransform = () => {
      const { pixelRatio } = canvasSizeRef.current
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.lineCap = "round"
      context.lineJoin = "round"
      context.strokeStyle = STROKE_COLOR
      context.fillStyle = STROKE_COLOR
      context.lineWidth = STROKE_SIZE
    }

    const drawDraftStroke = (stroke: DrawingPoint[]) => {
      if (!stroke.length) return
      const { width, height } = canvasSizeRef.current
      setCanvasTransform()
      context.beginPath()
      context.moveTo(stroke[0].x * width, stroke[0].y * height)
      if (stroke.length === 1) {
        context.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1)
      } else {
        for (const point of stroke.slice(1)) {
          context.lineTo(point.x * width, point.y * height)
        }
      }
      context.stroke()
    }

    const renderCanvas = () => {
      const { width, height } = canvasSizeRef.current
      if (!width || !height) return

      setCanvasTransform()
      context.fillStyle = BACKGROUND_COLOR
      context.fillRect(0, 0, width, height)
      context.fillStyle = STROKE_COLOR

      for (const outline of finalizedOutlinesRef.current) {
        drawOutline(context, outline, width, height)
      }

      if (activeStrokeRef.current) {
        drawDraftStroke(activeStrokeRef.current)
      }
    }

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      canvasBounds = bounds
      const pixelRatio = window.devicePixelRatio || 1
      const bitmapWidth = Math.round(bounds.width * pixelRatio)
      const bitmapHeight = Math.round(bounds.height * pixelRatio)

      canvasSizeRef.current = {
        width: bounds.width,
        height: bounds.height,
        pixelRatio,
      }
      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth
        canvas.height = bitmapHeight
      }
      renderCanvas()
    }

    const getDrawingPoint = (event: PointerEvent): DrawingPoint => ({
      x: (event.clientX - canvasBounds.left) / canvasBounds.width,
      y: (event.clientY - canvasBounds.top) / canvasBounds.height,
      pressure: Math.max(event.pressure || 0.5, 0.35),
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (
        disabledRef.current ||
        activePointerIdRef.current !== null ||
        (event.pointerType !== "pen" &&
          event.pointerType !== "touch" &&
          event.pointerType !== "mouse")
      ) {
        return
      }

      if (event.cancelable) event.preventDefault()
      canvasBounds = canvas.getBoundingClientRect()
      activePointerIdRef.current = event.pointerId
      if (event.pointerType === "pen") {
        document.documentElement.classList.add(DRAWING_WITH_PEN_CLASS)
      }
      activeStrokeRef.current = [getDrawingPoint(event)]
      setHasDrawing(true)
      drawDraftStroke(activeStrokeRef.current)
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch (captureError) {
        console.warn("Could not capture drawing pointer:", captureError)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return
      if (event.cancelable) event.preventDefault()

      const stroke = activeStrokeRef.current
      if (!stroke) return
      const coalescedEvents = event.getCoalescedEvents?.()
      const samples =
        coalescedEvents && coalescedEvents.length > 0
          ? coalescedEvents
          : [event]

      for (const sample of samples) {
        const point = getDrawingPoint(sample)
        const previousPoint = stroke[stroke.length - 1]
        const { width, height } = canvasSizeRef.current
        setCanvasTransform()
        context.beginPath()
        context.moveTo(previousPoint.x * width, previousPoint.y * height)
        context.lineTo(point.x * width, point.y * height)
        context.stroke()
        stroke.push(point)
      }
    }

    const finishPointer = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return
      const stroke = activeStrokeRef.current
      activePointerIdRef.current = null
      activeStrokeRef.current = null
      document.documentElement.classList.remove(DRAWING_WITH_PEN_CLASS)

      if (stroke?.length) {
        const { width, height } = canvasSizeRef.current
        const outline = getStroke(
          stroke.map((point) => [
            point.x * width,
            point.y * height,
            point.pressure,
          ]),
          {
            size: STROKE_SIZE,
            thinning: 0.55,
            smoothing: 0.5,
            streamline: 0.35,
            simulatePressure: false,
            last: true,
          },
        )
        finalizedOutlinesRef.current.push(
          outline.map(([x, y]) => [x / width, y / height]),
        )
        renderCanvas()
      }
    }

    const preventDefault = (event: Event) => event.preventDefault()
    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(canvas)
    resizeCanvas()
    canvas.addEventListener("pointerdown", handlePointerDown, {
      passive: false,
    })
    canvas.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    })
    canvas.addEventListener("pointerup", finishPointer)
    canvas.addEventListener("pointercancel", finishPointer)
    canvas.addEventListener("lostpointercapture", finishPointer)
    container.addEventListener("dragstart", preventDefault)
    container.addEventListener("selectstart", preventDefault)

    return () => {
      observer.disconnect()
      document.documentElement.classList.remove(DRAWING_WITH_PEN_CLASS)
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", finishPointer)
      canvas.removeEventListener("pointercancel", finishPointer)
      canvas.removeEventListener("lostpointercapture", finishPointer)
      container.removeEventListener("dragstart", preventDefault)
      container.removeEventListener("selectstart", preventDefault)
    }
  }, [isVisible])

  const clearDrawing = () => {
    finalizedOutlinesRef.current = []
    activeStrokeRef.current = null
    activePointerIdRef.current = null
    setHasDrawing(false)
    setError(null)
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const { width, height, pixelRatio } = canvasSizeRef.current
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.fillStyle = BACKGROUND_COLOR
    context.fillRect(0, 0, width, height)
  }

  const sendDrawing = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawing || disabled || isSending) return

    setIsSending(true)
    setError(null)
    try {
      await onSend(canvas.toDataURL("image/png"))
      clearDrawing()
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : String(sendError)
      console.error("Failed to export or send drawing:", sendError)
      setError(`手写内容发送失败：${message}`)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative mt-4 w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-[#fffaf0] shadow-lg"
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="收起手写板"
        title="收起手写板"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white transition-colors hover:bg-black/70"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
      <canvas
        ref={canvasRef}
        aria-label="手写板"
        className="block h-[240px] w-full touch-none"
        style={{ backgroundColor: BACKGROUND_COLOR }}
      />
      <div className="flex items-center justify-between border-t border-black/10 px-3 py-2.5">
        <div>
          <button
            type="button"
            onClick={clearDrawing}
            disabled={disabled || isSending || !hasDrawing}
            className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除
          </button>
          {error && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void sendDrawing()}
          disabled={disabled || isSending || !hasDrawing}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "发送中..." : "发送手写内容"}
        </button>
      </div>
    </div>
  )
}
