import { useEffect, useCallback } from "react"
import { PDFMessageType } from "../types/pdf-types"
import type { PDFBackendToClientMessage } from "../types/pdf-types"
import { useWebSocket } from "../context/WebSocketContext"

export interface PDFViewerInstance {
  loadFromBase64: (buffer: string) => void
  scrollToPage: (pageNum: number) => Promise<void>
  jumpToPage: (pageNum: number) => Promise<void>
  nextPage: () => Promise<void>
  previousPage: () => Promise<void>
  getCurrentPage: () => number
  getCurrentViewBase64: () => Promise<string> | string
}

export const usePDFService = (pdfViewer: PDFViewerInstance | null) => {
  const { sendMessage, subscribe } = useWebSocket()

  useEffect(() => {
    const handleMessage = async (msg: PDFBackendToClientMessage | any) => {
      if (!msg.type.startsWith("pdf:") || !pdfViewer) return

      switch (msg.type) {
        case PDFMessageType.JUMP_TO_PAGE: {
          await pdfViewer.jumpToPage(msg.payload.pageNum)
          const currentView = await pdfViewer.getCurrentViewBase64()
          sendMessage({
            type: PDFMessageType.JUMP_TO_PAGE_DONE,
            id: msg.id,
            payload: {
              pageNum: msg.payload.pageNum,
              currentView,
            },
          })
          break
        }

        case PDFMessageType.NEXT_PAGE: {
          await pdfViewer.nextPage()
          const pageNum = pdfViewer.getCurrentPage()
          const currentView = await pdfViewer.getCurrentViewBase64()
          sendMessage({
            type: PDFMessageType.NEXT_PAGE_DONE,
            id: msg.id,
            payload: { pageNum, currentView },
          })
          break
        }

        case PDFMessageType.PREVIOUS_PAGE: {
          await pdfViewer.previousPage()
          const pageNum = pdfViewer.getCurrentPage()
          const currentView = await pdfViewer.getCurrentViewBase64()
          sendMessage({
            type: PDFMessageType.PREVIOUS_PAGE_DONE,
            id: msg.id,
            payload: { pageNum, currentView },
          })
          break
        }

        case PDFMessageType.ERROR:
          console.error("PDF Error from backend:", msg.payload.error)
          break
      }
    }

    return subscribe(handleMessage)
  }, [subscribe, sendMessage, pdfViewer])

  const uploadPdfBuffer = useCallback(
    (base64String: string) => {
      sendMessage({
        type: PDFMessageType.BUFFER,
        payload: { buffer: base64String },
      })
    },
    [sendMessage],
  )

  return { uploadPdfBuffer }
}
