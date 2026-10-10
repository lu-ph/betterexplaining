import React, { useEffect, useRef } from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({ children, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const container = containerRef.current;
    if (!container) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setTimeout(() => {
          const currentScroll = window.scrollY || document.documentElement.scrollTop;
          if (currentScroll > 0) {
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
          }
        }, 120);
      }
    };

    if (isIOS) {
      document.addEventListener("focusout", handleFocusOut);
    }

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      let scrollTarget: HTMLElement | null = target;
      while (scrollTarget && scrollTarget !== container) {
        const style = window.getComputedStyle(scrollTarget);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          break;
        }
        scrollTarget = scrollTarget.parentElement;
      }

      if (!scrollTarget || scrollTarget === container) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      const currentY = e.touches.clientY;
      const diffY = currentY - startY;

      const scrollTop = scrollTarget.scrollTop;
      const scrollHeight = scrollTarget.scrollHeight;
      const clientHeight = scrollTarget.clientHeight;

      if (scrollTop <= 0 && diffY > 0) {
        if (e.cancelable) e.preventDefault();
      }

      if (scrollHeight - scrollTop - clientHeight <= 1 && diffY < 0) {
        if (e.cancelable) e.preventDefault();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      if (isIOS) {
        document.removeEventListener("focusout", handleFocusOut);
      }
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      let scrollTarget: HTMLElement | null = target;
      while (scrollTarget && scrollTarget !== container) {
        const style = window.getComputedStyle(scrollTarget);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          break;
        }
        scrollTarget = scrollTarget.parentElement;
      }

      if (!scrollTarget || scrollTarget === container) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;

      const scrollTop = scrollTarget.scrollTop;
      const scrollHeight = scrollTarget.scrollHeight;
      const clientHeight = scrollTarget.clientHeight;

      if (scrollTop <= 0 && diffY > 0) {
        if (e.cancelable) e.preventDefault();
      }

      if (scrollHeight - scrollTop - clientHeight <= 1 && diffY < 0) {
        if (e.cancelable) e.preventDefault();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div ref={containerRef} className={`w-full h-full min-h-0 flex flex-col ${className}`}>
      {children}
    </div>
  );
};