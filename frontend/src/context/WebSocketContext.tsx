import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react"
import { BackendToClientMessage, ClientToBackendMessage } from "../types/types"

interface WebSocketContextValue {
  sendMessage: (msg: ClientToBackendMessage) => void
  subscribe: (handler: (msg: BackendToClientMessage) => void) => () => void
  setSessionId: (sessionId: string) => void
  connectSession: () => Promise<void>
  isConnected: boolean
  error: string | null
  clearError: () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export const WebSocketProvider: React.FC<{
  url: string
  children: React.ReactNode
}> = ({ url, children }) => {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingMessagesRef = useRef<ClientToBackendMessage[]>([])
  const isActiveRef = useRef(false)
  const sessionIdRef = useRef<string | undefined>()
  const connectionPromiseRef = useRef<Promise<void> | null>(null)
  const [sessionId, setSessionId] = React.useState<string | undefined>()
  const [isConnected, setIsConnected] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const sessionUrl = React.useMemo(() => {
    if (!sessionId) return null
    const nextUrl = new URL(url)
    nextUrl.searchParams.set("sessionId", sessionId)
    return nextUrl.toString()
  }, [url, sessionId])

  const listenersRef = useRef<Set<(msg: BackendToClientMessage) => void>>(
    new Set(),
  )

  const connect = useCallback((targetUrl = sessionUrl) => {
    if (!isActiveRef.current || !targetUrl) return Promise.resolve()
    if (
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return Promise.resolve()
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return connectionPromiseRef.current || Promise.resolve()
    }

    const connectionPromise = new Promise<void>((resolve, reject) => {
      console.log("[WebSocket] Connecting:", targetUrl)
      const ws = new WebSocket(targetUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[WebSocket] Connected:", targetUrl)
        connectionPromiseRef.current = null
        setIsConnected(true)
        setError(null)
        resolve()
        const pendingMessages = pendingMessagesRef.current.splice(0)
        pendingMessages.forEach((message) => {
          console.log("[WebSocket] Sending:", message)
          ws.send(JSON.stringify(message))
        })
      }
      ws.onerror = (event) => {
        console.error("[WebSocket] Error:", event)
        setError("WebSocket 连接发生错误，请检查 API 服务是否正常运行。")
      }
      ws.onclose = (event) => {
        console.log("[WebSocket] Closed:", {
          code: event.code,
          reason: event.reason || "No reason provided",
          wasClean: event.wasClean,
        })
        if (wsRef.current === ws) wsRef.current = null
        setIsConnected(false)
        if (connectionPromiseRef.current) {
          connectionPromiseRef.current = null
          reject(new Error("WebSocket 连接失败"))
        }
        if (isActiveRef.current && event.code !== 1000) {
          setError(
            `WebSocket 连接已断开${event.reason ? `：${event.reason}` : "，请检查 API 服务。"}`,
          )
        }
      }
      ws.onmessage = (event) => {
        try {
          const message: BackendToClientMessage = JSON.parse(event.data)
          console.log("[WebSocket] Received:", message)
          if (
            (message.type === "agent:error" || message.type === "pdf:error") &&
            message.payload &&
            typeof message.payload === "object" &&
            "error" in message.payload
          ) {
            setError(String(message.payload.error))
          }
          listenersRef.current.forEach((listener) => listener(message))
        } catch (e) {
          console.error("Failed to parse WebSocket message", e)
          setError("收到无法解析的 WebSocket 消息。")
        }
      }
    })
    connectionPromiseRef.current = connectionPromise
    return connectionPromise
  }, [sessionUrl])

  useEffect(() => {
    isActiveRef.current = true

    return () => {
      isActiveRef.current = false
      pendingMessagesRef.current = []
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    (msg: ClientToBackendMessage) => {
      if (!sessionIdRef.current) {
        const message = "请先创建 Session，再发送 WebSocket 消息。"
        console.warn("[WebSocket] Ignored before session creation:", msg)
        setError(message)
        return
      }
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] Sending:", msg)
        ws.send(JSON.stringify(msg))
        return
      }

      console.log("[WebSocket] Queued until connected:", msg)
      pendingMessagesRef.current.push(msg)
      void connect()
    },
    [connect, sessionId],
  )

  const configureSession = useCallback((nextSessionId: string) => {
    sessionIdRef.current = nextSessionId
    setSessionId(nextSessionId)
    setError(null)
  }, [])

  const connectSession = useCallback(() => {
    if (!sessionIdRef.current) {
      return Promise.reject(new Error("请先创建 Session，再连接 WebSocket。"))
    }
    const nextUrl = new URL(url)
    nextUrl.searchParams.set("sessionId", sessionIdRef.current)
    return connect(nextUrl.toString())
  }, [connect, url])

  const subscribe = useCallback(
    (handler: (msg: BackendToClientMessage) => void) => {
      listenersRef.current.add(handler)
      return () => listenersRef.current.delete(handler)
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return (
    <WebSocketContext.Provider
      value={{
        sendMessage,
        subscribe,
        setSessionId: configureSession,
        connectSession,
        isConnected,
        error,
        clearError,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context)
    throw new Error("useWebSocket must be used within WebSocketProvider")
  return context
}
