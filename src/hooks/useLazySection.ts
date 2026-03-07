import { useState, useEffect, useRef, useCallback } from "react";

interface UseLazySectionOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook para lazy loading de seções usando IntersectionObserver.
 * Retorna uma ref para o elemento e um boolean indicando se está visível.
 */
export function useLazySection<T extends HTMLElement = HTMLDivElement>(
  options: UseLazySectionOptions = {}
): {
  ref: React.RefObject<T | null>;
  isVisible: boolean;
  hasBeenVisible: boolean;
} {
  const { threshold = 0.1, rootMargin = "100px", triggerOnce = true } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Fallback for SSR or browsers without IntersectionObserver
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            if (triggerOnce) {
              observer.unobserve(element);
            }
          } else if (!triggerOnce) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible, hasBeenVisible };
}

/**
 * Componente wrapper para lazy loading de seções.
 * Renderiza children apenas quando a seção está visível.
 */
interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
}

export function LazySection({
  children,
  fallback,
  className = "",
  threshold = 0.1,
  rootMargin = "100px",
}: LazySectionProps) {
  const { ref, hasBeenVisible } = useLazySection<HTMLDivElement>({
    threshold,
    rootMargin,
    triggerOnce: true,
  });

  return (
    <div ref={ref} className={className}>
      {hasBeenVisible ? children : fallback}
    </div>
  );
}
