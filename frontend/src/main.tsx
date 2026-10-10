import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import Introduction from "./Introduction"
import { WebSocketProvider } from "./context/WebSocketContext"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element was not found")
}

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}


const page =
  window.location.pathname === "/introduction" ? <Introduction /> : <App />

createRoot(rootElement).render(
  <StrictMode>
    <WebSocketProvider
      url={import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws"}
    >
      {page}
    </WebSocketProvider>
  </StrictMode>,
)
