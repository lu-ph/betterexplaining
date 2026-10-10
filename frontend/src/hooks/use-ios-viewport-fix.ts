import { useEffect } from "react"

export function useIOSViewportFix() {
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
      document.documentElement.scrollTop = 0
    }

    const handleVisualViewport = () => {
      if (!window.visualViewport) return
      if (window.visualViewport.offsetTop === 0) {
        resetScroll()
      }
    }

    const handleBlur = () => {
      setTimeout(resetScroll, 100)
    }

    window.visualViewport?.addEventListener("resize", handleVisualViewport)
    document.addEventListener("blur", handleBlur, true)

    return () => {
      window.visualViewport?.removeEventListener("resize", handleVisualViewport)
      document.removeEventListener("blur", handleBlur, true)
    }
  }, [])
}
