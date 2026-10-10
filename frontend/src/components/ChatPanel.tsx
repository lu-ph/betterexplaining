import { FormEvent, useState, useRef, useEffect, ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { ChatMessage } from "../hooks/use-agent-service"

interface ChatPanelProps {
  isFullScreen: boolean
  chatHistory: ChatMessage[]
  currentReply: string
  isGenerating: boolean
  canSendMessage: boolean
  onSend: (prompt: string) => void
  onUploadImages: (files: File[]) => void
  pendingImageCount: number
  onInterrupt: () => void
}

const formatToolValue = (value: unknown) => {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const mathExpressionPattern =
  /(?:\\[a-zA-Z]+|[=+\-*/^]|\b(?:sin|cos|tan|log|ln|sqrt|frac|sum|int)\b)/

const normalizeMathDelimiters = (value: string) => {
  let normalized = value
    .replace(
      /\\\[([\s\S]*?)\\\]/g,
      (_, expression: string) => `$$\n${expression.trim()}\n$$`,
    )
    .replace(
      /\\\(([^\n]*?)\\\)/g,
      (_, expression: string) => `$${expression.trim()}$`,
    )

  normalized = normalized.replace(
    /(^|[\s：:])\[([^\]\n]+)\](?=$|[\s，。；：:])/g,
    (match, prefix, expression) => {
      if (!mathExpressionPattern.test(expression)) return match
      return `${prefix}$${expression.trim()}$`
    },
  )

  return normalized.replace(
    /(^|[\s：:])\(([^()\n]+)\)(?=$|[\s，。；：:])/g,
    (match, prefix, expression) => {
      if (!mathExpressionPattern.test(expression)) return match
      return `${prefix}$${expression.trim()}$`
    },
  )
}

const markdownComponents = {
  p({ children }: { children?: ReactNode }) {
    const textContent = String(children || "").trim()
    const isQuestion = /[?？]\s*$/.test(textContent)

    if (isQuestion) {
      return (
        <p className="my-4 border-l-2 border-indigo-500/80 pl-3.5 font-semibold text-white leading-relaxed">
          {children}
        </p>
      )
    }

    return (
      <p className="my-4 leading-relaxed text-neutral-300/90">{children}</p>
    )
  },
  li({ children }: { children?: ReactNode }) {
    const textContent = String(children || "").trim()
    const isQuestion = /[?？]\s*$/.test(textContent)

    if (isQuestion) {
      return (
        <li className="ml-4 list-disc my-1.5 border-l-2 border-indigo-500/80 pl-2 font-semibold text-white">
          {children}
        </li>
      )
    }
    return (
      <li className="ml-4 list-disc my-1.5 text-neutral-300/90">{children}</li>
    )
  },
}

export function ChatPanel({
  isFullScreen,
  chatHistory,
  currentReply,
  isGenerating,
  canSendMessage,
  onSend,
  onUploadImages,
  pendingImageCount,
  onInterrupt,
}: ChatPanelProps) {
  const [prompt, setPrompt] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory, currentReply, isGenerating])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextPrompt = prompt.trim()
    if (
      (!nextPrompt && pendingImageCount === 0) ||
      isGenerating ||
      !canSendMessage
    )
      return
    onSend(nextPrompt)
    setPrompt("")
  }

  const lastMessage = chatHistory[chatHistory.length - 1]
  const shouldRenderCurrentReply = lastMessage?.role !== "agent"

  return (
    <div
      className={`min-h-0 min-w-0 h-full flex flex-col relative bg-[#09090B] font-sans antialiased text-[15px] ${
        isFullScreen ? "w-full" : "w-1/2 border-l border-white/[0.06]"
      }`}
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 md:px-12 pt-8 pb-36 space-y-9 scroll-smooth"
      >
        {chatHistory.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "flex flex-col items-end"
                : "w-full max-w-3xl"
            }
          >
            {message.role === "tool" ? (
              <details className="group my-2 w-full max-w-xl rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs text-neutral-400 transition-all duration-200 open:bg-white/[0.03]">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 text-neutral-400 transition-colors hover:text-neutral-200 [&::-webkit-details-marker]:hidden">
                  <span className="text-[10px] text-neutral-500 transition-transform duration-200 group-open:rotate-90">
                    ▲
                  </span>
                  <span className="font-medium text-neutral-400">工具调用</span>
                  <span className="font-mono text-sky-400/90 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                    {message.name}
                  </span>
                  {message.result === undefined && !message.error && (
                    <span className="ml-auto flex items-center gap-1.5 text-amber-400/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      执行中...
                    </span>
                  )}
                  {(message.result !== undefined || message.error) && (
                    <span
                      className={`ml-auto flex items-center gap-1.5 ${
                        message.error ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          message.error ? "bg-rose-400" : "bg-emerald-400"
                        }`}
                      />
                      {message.error ? "失败" : "已完成"}
                    </span>
                  )}
                </summary>
                <div className="space-y-3 border-t border-white/[0.06] px-4 py-3 font-mono">
                  <div>
                    <div className="mb-1 text-[11px] text-neutral-500 uppercase tracking-wider">
                      Input
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 text-neutral-300 text-[11px] leading-relaxed border border-white/[0.04]">
                      {formatToolValue(message.input)}
                    </pre>
                  </div>
                  {(message.result !== undefined || message.error) && (
                    <div>
                      <div className="mb-1 text-[11px] text-neutral-500 uppercase tracking-wider">
                        {message.error ? "Error" : "Result"}
                      </div>
                      <pre
                        className={`overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 text-[11px] leading-relaxed border border-white/[0.04] ${
                          message.error ? "text-rose-300" : "text-neutral-300"
                        }`}
                      >
                        {message.error || formatToolValue(message.result)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            ) : message.role === "user" ? (
              <div className="flex max-w-[85%] flex-col items-end gap-2">
                {message.image && (
                  <img
                    src={message.image}
                    alt="用户上传的图片"
                    className="max-h-72 max-w-full rounded-2xl border border-white/[0.08] object-contain"
                  />
                )}
                {message.text && (
                  <div className="bg-neutral-800/90 text-neutral-100 px-5 py-3.5 rounded-2xl rounded-tr-md max-w-full text-[15px] leading-relaxed shadow-sm border border-white/[0.06] [&_a]:text-sky-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-500 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-black/40 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/60 [&_pre]:p-4 [&_pre_code]:bg-transparent">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {normalizeMathDelimiters(message.text)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full text-neutral-200 text-[15px] leading-relaxed tracking-normal [&_a]:text-sky-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-700 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/50 [&_pre]:p-4 [&_pre]:border [&_pre]:border-white/[0.08] [&_pre_code]:bg-transparent [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_hr]:my-6 [&_hr]:border-white/[0.08] [&_ol]:my-3 [&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:border-neutral-800 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-neutral-800 [&_th]:bg-neutral-900 [&_th]:px-3 [&_th]:py-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={markdownComponents}
                >
                  {normalizeMathDelimiters(message.text)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {(isGenerating || currentReply) && shouldRenderCurrentReply && (
          <div className="w-full max-w-3xl text-neutral-200 text-[15px] leading-relaxed">
            {isGenerating && !currentReply && (
              <div className="flex items-center gap-2 py-2 text-sm font-medium text-neutral-300 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-neutral-300 animate-pulse" />
                <span>正在思考...</span>
              </div>
            )}
            {currentReply && (
              <div className="[&_a]:text-sky-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-700 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/50 [&_pre]:p-4 [&_pre]:border [&_pre]:border-white/[0.08] [&_pre_code]:bg-transparent [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_hr]:my-6 [&_hr]:border-white/[0.08] [&_ol]:my-3 [&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:border-neutral-800 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-neutral-800 [&_th]:bg-neutral-900 [&_th]:px-3 [&_th]:py-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={markdownComponents}
                >
                  {normalizeMathDelimiters(currentReply)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#09090B] via-[#09090B]/90 to-transparent pointer-events-none">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto relative w-full max-w-2xl mx-auto flex items-center bg-neutral-900/80 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-1.5 shadow-2xl focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/20 transition-all duration-200 group"
        >
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={!canSendMessage}
            title={
              pendingImageCount > 0
                ? `添加图片（${pendingImageCount} 张待发送）`
                : "添加图片"
            }
            className="relative p-2.5 text-neutral-400 hover:text-white transition-colors rounded-xl hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
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
                strokeWidth={1.75}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            {pendingImageCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
                {pendingImageCount}
              </span>
            )}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              onUploadImages(Array.from(event.target.files || []))
              event.target.value = ""
            }}
          />
          <input
            type="text"
            placeholder="继续追问..."
            value={prompt}
            disabled={!canSendMessage}
            onChange={(event) => setPrompt(event.target.value)}
            className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder:text-neutral-500 text-[14px] px-3 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type={isGenerating ? "button" : "submit"}
            onClick={isGenerating ? onInterrupt : undefined}
            disabled={!canSendMessage}
            className="bg-white text-black px-4 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-150 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 border border-white/10"
          >
            {!canSendMessage ? "已停止" : isGenerating ? "停止" : "发送"}
          </button>
        </form>
      </div>
    </div>
  )
}
