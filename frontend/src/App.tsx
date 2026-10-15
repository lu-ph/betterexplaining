import React, { ChangeEvent, useRef, useState } from "react"
import { ChatPanel } from "./components/ChatPanel"
import { FileViewer } from "./components/FileViewer"
// import { FileViewerHandle } from "./components/FileViewer"
import { PDFCoverPreview } from "./components/PDFCoverPreview"
import { useAgentService } from "./hooks/use-agent-service"
// import { usePDFService } from "./hooks/use-pdf-service"
import { filesToDataUrls } from "./lib/file-utils"
import { Container } from "./Container"
import { useIOSViewportFix } from "./hooks/use-ios-viewport-fix"

const MAX_FILE_SIZE_KB = 100000
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024

export default function App() {
  useIOSViewportFix()
  const {
    chatHistory,
    conversation,
    currentReply,
    isGenerating,
    canSendMessage,
    sendChatRequest,
    interruptChat,
    clearConversation,
    error: agentError,
    reportError,
    clearError: clearAgentError,
  } = useAgentService()
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(() =>
    conversation.flatMap((message, index) => {
      if (!message.image) return []

      const match = /^data:(image\/[^;,]+);base64,(.+)$/.exec(message.image)
      if (!match) return []

      const bytes = Uint8Array.from(atob(match[2]), (char) =>
        char.charCodeAt(0),
      )
      const extension = match[1].split("/")[1] || "image"
      return [
        new File([bytes], `conversation-image-${index + 1}.${extension}`, {
          type: match[1],
        }),
      ]
    }),
  )
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({})
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([])
  const [hasStarted, setHasStarted] = useState(conversation.length > 0)
  // const [pdfViewer, setPdfViewer] = useState<FileViewerHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  // usePDFService(pdfViewer)

  const pdfFile = uploadedFiles.find((f) => f.type === "application/pdf")
  const imageFiles = uploadedFiles.filter((f) => f.type.startsWith("image/"))

  const addFiles = (files: File[]) => {
    if (files.length === 0) return

    const validFiles: File[] = []
    let currentPdfCount = pdfFile ? 1 : 0
    let hasAlertedPdf = false

    files.forEach((file) => {
      const isValidSize = file.size <= MAX_FILE_SIZE_BYTES
      if (!isValidSize) return

      if (file.type === "application/pdf") {
        if (currentPdfCount === 0) {
          validFiles.push(file)
          currentPdfCount++
        } else if (!hasAlertedPdf) {
          alert("只能上传一个 PDF 文件。多余的 PDF 已被忽略。")
          hasAlertedPdf = true
        }
      } else if (file.type.startsWith("image/")) {
        validFiles.push(file)
      }
    })

    if (validFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...validFiles])
      setPendingImageFiles((prev) => [
        ...prev,
        ...validFiles.filter((file) => file.type.startsWith("image/")),
      ])

      validFiles.forEach((file) => {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file)
          setFilePreviews((prev) => ({ ...prev, [file.name]: url }))
        }
      })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleUploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    addFiles(files)
  }

  const handleUploadImages = (files: File[]) => {
    addFiles(files.filter((file) => file.type.startsWith("image/")))
  }

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName))
    setPendingImageFiles((prev) =>
      prev.filter((file) => file.name !== fileName),
    )
    if (filePreviews[fileName]) {
      URL.revokeObjectURL(filePreviews[fileName])
      setFilePreviews((prev) => {
        const newPreviews = { ...prev }
        delete newPreviews[fileName]
        return newPreviews
      })
    }
  }

  const handleStartChat = async (text: string) => {
    const prompt = text.trim()
    if (uploadedFiles.length === 0 && !text.trim()) return
    setHasStarted(true)

    try {
      setApiError(null)
      const imageData = await filesToDataUrls(pendingImageFiles)
      await sendChatRequest(
        prompt ||
          (pdfFile
            ? "我上传了一个 PDF，但当前聊天接口不支持读取 PDF 内容。请提示我上传需要讨论的页面图片。"
            : "你好"),
        imageData,
      )
      setPendingImageFiles([])
    } catch (error) {
      const message = error instanceof Error ? error.message : "文件处理失败"
      console.error("Failed to prepare uploaded files:", error)
      setApiError(message)
      reportError(message)
    }
  }

  const handleChatRequest = async (
    prompt: string,
    displayUserMessage = true,
  ) => {
    try {
      const imageData = displayUserMessage
        ? await filesToDataUrls(pendingImageFiles)
        : []
      await sendChatRequest(prompt, imageData, { displayUserMessage })
      if (displayUserMessage) setPendingImageFiles([])
    } catch (error) {
      const message = error instanceof Error ? error.message : "消息发送失败"
      console.error("Failed to prepare chat images:", error)
      setApiError(message)
      reportError(message)
    }
  }

  const handleSendDrawing = async (drawingImage: string) => {
    try {
      const uploadedImageData = await filesToDataUrls(pendingImageFiles)
      await sendChatRequest("", [...uploadedImageData, drawingImage])
      setPendingImageFiles([])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "手写内容发送失败"
      console.error("Failed to send drawing:", error)
      setApiError(message)
      reportError(message)
      throw error
    }
  }

  const handleNewQuestion = () => {
    try {
      clearConversation()
      Object.values(filePreviews).forEach((url) => URL.revokeObjectURL(url))
      setUploadedFiles([])
      setPendingImageFiles([])
      setFilePreviews({})
      setHasStarted(false)
      setApiError(null)
      clearAgentError()
      // setPdfViewer(null)
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "无法清空当前对话"
      console.error("Failed to start a new question:", error)
      setApiError(message)
    }
  }

  const renderStagingArea = () => {
    // scenario 1：PDF + images
    if (pdfFile) {
      return (
        <div className="flex flex-col items-center justify-center w-full max-h-[65vh] animate-in fade-in zoom-in-95 duration-500">
          {/* PDF Card */}
          <div
            className="relative group bg-neutral-900 rounded-xl border border-white/10 shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all hover:border-white/20"
            style={{ width: "320px", height: "452px" }} /* A4 比例 1:1.414 */
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeFile(pdfFile.name)
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500/80"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="relative h-full w-full bg-neutral-900">
              <PDFCoverPreview file={pdfFile} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-5 pt-16">
                <p className="text-center text-sm font-medium leading-relaxed text-white break-all line-clamp-2">
                  {pdfFile.name}
                </p>
                <p className="mt-1 text-center font-mono text-xs text-neutral-300">
                  {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>

          {/* button images */}
          {imageFiles.length > 0 && (
            <div className="mt-8 flex items-center gap-4 w-full max-w-2xl overflow-x-auto pb-4 custom-scrollbar justify-center">
              {imageFiles.map((img) => (
                <div key={img.name} className="relative group shrink-0">
                  <button
                    onClick={() => removeFile(img.name)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500 text-xs"
                  >
                    ×
                  </button>
                  <img
                    src={filePreviews[img.name]}
                    className="w-16 h-16 object-cover rounded-xl border border-white/10 shadow-lg"
                    alt="preview"
                  />
                </div>
              ))}
              {/* add button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 shrink-0 rounded-xl border border-dashed border-neutral-700 flex items-center justify-center text-neutral-500 hover:border-neutral-400 hover:text-neutral-300 transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      )
    }

    // scenario 2: 1 image only
    if (imageFiles.length === 1) {
      const img = imageFiles[0]
      return (
        <div className="flex flex-col items-center justify-center w-full max-h-[65vh] animate-in fade-in zoom-in-95 duration-500">
          <div className="relative group inline-flex h-full items-center justify-center max-w-[75%]">
            <button
              onClick={() => removeFile(img.name)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-500/80 shadow-xl"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <img
              src={filePreviews[img.name]}
              className="max-w-full max-h-[60vh] object-contain rounded-2xl border border-white/10 shadow-2xl relative z-10"
              alt="Single view"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="absolute top-1/2 -translate-y-1/2 left-full ml-8 w-20 h-20 shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-neutral-700/80 rounded-2xl cursor-pointer hover:bg-neutral-800 hover:border-neutral-500 transition-all group shadow-sm bg-[#09090B] z-10"
              title="添加更多图片或 PDF"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-800/80 flex items-center justify-center group-hover:scale-110 group-hover:bg-neutral-700 transition-all">
                <svg
                  className="w-6 h-6 text-neutral-400 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // scenario 3：multiple images without pdf
    if (imageFiles.length > 1) {
      return (
        <div className="w-full flex-1 max-h-[65vh] flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8">
          <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl overflow-y-auto p-4">
            {imageFiles.map((img) => (
              <div
                key={img.name}
                className="group relative w-64 h-64 bg-neutral-900 rounded-2xl border border-white/10 shadow-xl overflow-hidden hover:scale-[1.02] transition-transform"
              >
                <button
                  onClick={() => removeFile(img.name)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500/80"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <img
                  src={filePreviews[img.name]}
                  className="w-full h-full object-cover"
                  alt="preview"
                />
              </div>
            ))}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-64 h-64 flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl cursor-pointer hover:bg-neutral-900/50 hover:border-neutral-600 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <Container className="h-full overflow-hidden bg-[#09090B] text-neutral-200 font-sans selection:bg-white/20 flex flex-col">
      {(agentError || apiError) && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-2xl items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur-xl">
            <span className="mt-0.5 shrink-0 font-bold text-rose-300">!</span>
            <p className="min-w-0 flex-1 break-words">
              {agentError || apiError}
            </p>
            <button
              type="button"
              onClick={() => {
                clearAgentError()
                setApiError(null)
              }}
              className="shrink-0 text-rose-200/70 transition-colors hover:text-white"
              aria-label="关闭错误提示"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <header className="h-16 flex items-center px-6 border-b border-white/5 shrink-0 z-10">
        <h1 className="text-xl font-semibold tracking-tight text-white font-serif"></h1>
        {hasStarted && (
          <button
            type="button"
            onClick={handleNewQuestion}
            className="ml-auto mr-5 rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            问新的问题
          </button>
        )}
        <a
          href="/introduction"
          target="_blank"
          rel="noreferrer"
          className={`${hasStarted ? "" : "ml-auto"} text-sm text-neutral-500 transition-colors hover:text-white`}
        >
          这个网页做什么？
        </a>
      </header>

      <main className="min-h-0 flex-1 relative overflow-hidden flex flex-col">
        {!hasStarted && (
          <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col h-full p-6 relative">
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
              {uploadedFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-4xl aspect-[21/9] rounded-[2rem] border-2 border-dashed border-neutral-800 bg-neutral-900/20 hover:bg-neutral-800/40 hover:border-neutral-600 transition-all duration-300 flex flex-col items-center justify-center gap-6 cursor-pointer group animate-in fade-in zoom-in-95"
                >
                  <div className="w-20 h-20 rounded-2xl bg-neutral-800 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center shadow-lg">
                    <svg
                      className="w-10 h-10 text-neutral-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl text-white font-medium mb-3 tracking-tight">
                      问什么 ?
                    </h2>
                    <p className="text-neutral-500"></p>
                  </div>
                </div>
              ) : (
                renderStagingArea()
              )}
            </div>

            <div
              className={`shrink-0 w-full max-w-3xl mx-auto px-4 pb-6 mt-auto transition-all duration-500 ${
                uploadedFiles.length > 0
                  ? "translate-y-0 opacity-100 scale-100"
                  : ""
              }`}
            >
              <div className="relative group flex items-center bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500 transition-all p-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
                  title="添加文件"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    uploadedFiles.length > 0
                      ? "向 AI 描述你的需求..."
                      : "输入问题..."
                  }
                  className="flex-1 bg-transparent h-12 px-4 focus:outline-none text-white placeholder:text-neutral-500 text-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleStartChat(e.currentTarget.value)
                  }}
                />

                <button
                  onClick={() => handleStartChat(inputRef.current?.value || "")}
                  className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center hover:bg-neutral-200 transition-colors shrink-0"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf,image/*"
          className="hidden"
          multiple
          onChange={handleUploadFile}
        />

        {hasStarted && (
          <div className="min-h-0 flex-1 flex w-full h-full animate-in fade-in duration-500 overscroll-contain touch-auto">
            {uploadedFiles.length > 0 && (
              <>
                {/* <FileViewer ref={setPdfViewer} files={uploadedFiles} /> */}
                <FileViewer files={uploadedFiles} />
              </>
            )}
            <ChatPanel
              isFullScreen={uploadedFiles.length === 0}
              chatHistory={chatHistory}
              currentReply={currentReply}
              isGenerating={isGenerating}
              canSendMessage={canSendMessage}
              onSend={handleChatRequest}
              onSendDrawing={handleSendDrawing}
              onUploadImages={handleUploadImages}
              pendingImageCount={pendingImageFiles.length}
              onInterrupt={interruptChat}
            />
          </div>
        )}
      </main>
    </Container>
  )
}
