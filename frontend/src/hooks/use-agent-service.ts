import { useCallback, useRef, useState } from "react"

const CHAT_STORAGE_KEY = "betterexplaining:chat-messages"

export interface MessagePayload {
  role: "user" | "assistant"
  content: string
  image?: string
  hidden?: boolean
}

interface SendChatOptions {
  displayUserMessage?: boolean
}

export type ChatMessage =
  | { role: "user"; text: string; image?: string }
  | { role: "agent"; text: string; id?: string }
  | {
      role: "tool"
      id: string
      name: string
      input: Record<string, unknown>
      result?: unknown
      error?: string
    }

const isMessagePayload = (value: unknown): value is MessagePayload => {
  if (value === null || typeof value !== "object") return false
  if (!("role" in value) || !("content" in value)) return false

  return (
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    (!("image" in value) || typeof value.image === "string") &&
    (!("hidden" in value) || typeof value.hidden === "boolean")
  )
}

const getHttpBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, "")

  // const websocketUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws"
  // return websocketUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "")
  return "http://localhost:8080"
}

const readConversation = (): MessagePayload[] => {
  try {
    const storedMessages = sessionStorage.getItem(CHAT_STORAGE_KEY)
    if (!storedMessages) return []

    const parsed: unknown = JSON.parse(storedMessages)
    if (!Array.isArray(parsed) || !parsed.every(isMessagePayload)) {
      throw new Error("Stored chat context has an invalid format")
    }

    return parsed
  } catch (error) {
    console.error("Failed to restore chat context from sessionStorage:", error)
    return []
  }
}

const persistConversation = (messages: MessagePayload[]) => {
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
  } catch (error) {
    throw new Error(
      `Failed to save chat context to sessionStorage: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

const toChatHistory = (messages: MessagePayload[]): ChatMessage[] =>
  messages
    .filter((message) => !message.hidden)
    .map((message) =>
      message.role === "assistant"
        ? { role: "agent", text: message.content }
        : {
            role: "user",
            text: message.content,
            ...(message.image ? { image: message.image } : {}),
          },
    )

export const useAgentService = () => {
  const [initialConversation] = useState(readConversation)
  const [conversation, setConversation] = useState(initialConversation)
  const conversationRef = useRef(initialConversation)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() =>
    toChatHistory(initialConversation),
  )
  const [currentReply, setCurrentReply] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [canSendMessage, setCanSendMessage] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentReplyRef = useRef("")
  const replyMessageIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendChatRequest = useCallback(
    async (
      prompt: string,
      images: string[] = [],
      { displayUserMessage = true }: SendChatOptions = {},
    ) => {
      if (abortControllerRef.current) return

      setError(null)
      setIsGenerating(true)
      setCanSendMessage(true)
      currentReplyRef.current = ""
      setCurrentReply("")
      const replyMessageId = `agent-response-${++replyMessageIdRef.current}`

      const userMessages: MessagePayload[] = images.map((image) => ({
        role: "user",
        content: "",
        image,
      }))
      if (prompt) {
        userMessages.push({
          role: "user",
          content: prompt,
          ...(!displayUserMessage ? { hidden: true } : {}),
        })
      }
      const nextConversation = [...conversationRef.current, ...userMessages]
      let requestController: AbortController | null = null

      try {
        persistConversation(nextConversation)
        conversationRef.current = nextConversation
        setConversation(nextConversation)
        if (displayUserMessage) {
          setChatHistory((prev) => [
            ...prev,
            ...userMessages.map((message): ChatMessage => ({
              role: "user",
              text: message.content,
              ...(message.image ? { image: message.image } : {}),
            })),
          ])
        }

        requestController = new AbortController()
        abortControllerRef.current = requestController
        const response = await fetch(`${getHttpBaseUrl()}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextConversation }),
          signal: requestController.signal,
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(
            `Chat request failed (${response.status}): ${message || response.statusText}`,
          )
        }
        if (!response.body) {
          throw new Error("Chat response did not include a stream")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let streamFinished = false

        const processEvent = (frame: string) => {
          let eventType = "message"
          const dataLines: string[] = []
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim()
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart())
            }
          }
          if (dataLines.length === 0) return

          const data = dataLines.join("\n")
          let payload: { content?: unknown; error?: unknown }
          try {
            payload = JSON.parse(data)
          } catch (parseError) {
            throw new Error(
              `Failed to parse chat stream event: ${
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError)
              }`,
            )
          }

          if (eventType === "error") {
            throw new Error(
              typeof payload.error === "string"
                ? payload.error
                : "Chat stream returned an unknown error",
            )
          }
          if (payload.content === "[DONE]") {
            streamFinished = true
            return
          }
          if (typeof payload.content !== "string") {
            throw new Error("Chat stream event did not include string content")
          }

          currentReplyRef.current += payload.content
          const reply = currentReplyRef.current
          setCurrentReply(reply)
          setChatHistory((prev) => {
            const replyIndex = prev.findIndex(
              (message) =>
                message.role === "agent" && message.id === replyMessageId,
            )
            if (replyIndex !== -1) {
              return prev.map((message, index) =>
                index === replyIndex && message.role === "agent"
                  ? { ...message, text: reply }
                  : message,
              )
            }
            return [...prev, { role: "agent", id: replyMessageId, text: reply }]
          })
        }

        while (!streamFinished) {
          const { done, value } = await reader.read()
          buffer += decoder
            .decode(value, { stream: !done })
            .replace(/\r\n/g, "\n")

          let boundary = buffer.indexOf("\n\n")
          while (boundary !== -1) {
            processEvent(buffer.slice(0, boundary))
            buffer = buffer.slice(boundary + 2)
            if (streamFinished) break
            boundary = buffer.indexOf("\n\n")
          }

          if (done) {
            if (buffer.trim()) processEvent(buffer)
            break
          }
        }

        if (!streamFinished) {
          throw new Error("Chat stream ended before completion")
        }

        const reply = currentReplyRef.current
        if (reply) {
          const completedConversation = [
            ...conversationRef.current,
            { role: "assistant" as const, content: reply },
          ]
          persistConversation(completedConversation)
          conversationRef.current = completedConversation
          setConversation(completedConversation)
        }
      } catch (requestError) {
        if (
          !(requestError instanceof DOMException) ||
          requestError.name !== "AbortError"
        ) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Chat request failed"
          console.error("Chat request failed:", requestError)
          setError(message)
        }
      } finally {
        if (abortControllerRef.current === requestController) {
          abortControllerRef.current = null
        }
        setIsGenerating(false)
        currentReplyRef.current = ""
        setCurrentReply("")
      }
    },
    [],
  )

  const clearConversation = useCallback(() => {
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY)
    } catch (storageError) {
      throw new Error(
        `Failed to clear chat context from sessionStorage: ${
          storageError instanceof Error
            ? storageError.message
            : String(storageError)
        }`,
      )
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    conversationRef.current = []
    currentReplyRef.current = ""
    setConversation([])
    setChatHistory([])
    setCurrentReply("")
    setIsGenerating(false)
    setCanSendMessage(true)
    setError(null)
  }, [])

  const interruptChat = useCallback(() => {
    setCanSendMessage(false)
    setIsGenerating(false)
    const partialReply = currentReplyRef.current
    if (partialReply) {
      const interruptedConversation = [
        ...conversationRef.current,
        { role: "assistant" as const, content: partialReply },
      ]
      try {
        persistConversation(interruptedConversation)
        conversationRef.current = interruptedConversation
        setConversation(interruptedConversation)
      } catch (storageError) {
        const message =
          storageError instanceof Error
            ? storageError.message
            : String(storageError)
        console.error("Failed to save interrupted chat response:", storageError)
        setError(message)
      }
    }
    currentReplyRef.current = ""
    setCurrentReply("")
    abortControllerRef.current?.abort()
  }, [])

  const reportError = useCallback((message: string) => {
    setError(message)
    setIsGenerating(false)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    chatHistory,
    conversation,
    currentReply,
    isGenerating,
    canSendMessage,
    error,
    reportError,
    clearError,
    clearConversation,
    sendChatRequest,
    interruptChat,
  }
}
