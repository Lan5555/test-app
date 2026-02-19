import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Announcement {
  id: string;
  tag?: string;
  title: string;
  body: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  date?: string;
}

interface AnnouncementModalProps {
  announcements: Announcement[];
  isOpen: boolean;
  onClose: () => void;
}

// ─── Inline Styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(4, 4, 12, 0.75)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "1rem",
    animation: "fadeIn 0.25s ease",
  },
  modal: {
    position: "relative",
    width: "100%",
    maxWidth: "540px",
    background: "linear-gradient(145deg, #0d0d1a 0%, #0a0a14 100%)",
    border: "1px solid rgba(120, 80, 255, 0.25)",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow:
      "0 0 0 1px rgba(120,80,255,0.08), 0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(100,60,255,0.08) inset",
    animation: "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "2px",
    background:
      "linear-gradient(90deg, transparent, #7c4dff, #e040fb, #7c4dff, transparent)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2.5s linear infinite",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.5rem 1.75rem 0",
  },
  logo: {
    fontFamily: "'Courier New', monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.25em",
    color: "rgba(180,160,255,0.5)",
    textTransform: "uppercase" as const,
  },
  closeBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "1px solid rgba(120,80,255,0.2)",
    background: "rgba(120,80,255,0.06)",
    color: "rgba(180,160,255,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontSize: "1rem",
    lineHeight: 1,
    flexShrink: 0,
  },
  card: {
    padding: "1.25rem 1.75rem",
    minHeight: "220px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.2rem 0.65rem",
    borderRadius: "999px",
    background: "rgba(124,77,255,0.12)",
    border: "1px solid rgba(124,77,255,0.25)",
    color: "#b39dff",
    fontSize: "0.7rem",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    width: "fit-content",
  },
  tagDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#7c4dff",
    boxShadow: "0 0 6px #7c4dff",
    animation: "pulse 2s ease-in-out infinite",
  },
  title: {
    fontFamily: "'Georgia', serif",
    fontSize: "1.55rem",
    fontWeight: 700,
    color: "#f0ecff",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  body: {
    fontFamily:
      "'Hiragino Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: "0.9rem",
    color: "rgba(200,185,255,0.65)",
    lineHeight: 1.7,
    margin: 0,
    flex: 1,
  },
  date: {
    fontFamily: "'Courier New', monospace",
    fontSize: "0.68rem",
    color: "rgba(150,130,200,0.35)",
    letterSpacing: "0.08em",
  },
  cta: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.55rem 1.1rem",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #5e35b1, #7c4dff)",
    color: "#f0ecff",
    fontSize: "0.82rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s ease",
    textDecoration: "none",
    width: "fit-content",
    boxShadow: "0 4px 20px rgba(124,77,255,0.35)",
  },
  footer: {
    padding: "1rem 1.75rem 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(120,80,255,0.1)",
    gap: "1rem",
  },
  dots: {
    display: "flex",
    gap: "0.4rem",
    alignItems: "center",
  },
  navBtns: {
    display: "flex",
    gap: "0.5rem",
  },
  navBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(120,80,255,0.2)",
    background: "rgba(120,80,255,0.06)",
    color: "rgba(180,160,255,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontSize: "0.8rem",
  },
};

// ─── Keyframes (injected once) ────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px) scale(0.96) }
    to   { opacity: 1; transform: translateY(0) scale(1) }
  }
  @keyframes shimmer { from { background-position: -200% 0 } to { background-position: 200% 0 } }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1) }
    50%       { opacity: 0.5; transform: scale(0.75) }
  }
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateX(12px) }
    to   { opacity: 1; transform: translateX(0) }
  }
`;

let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected) return;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AnnouncementModal({
  announcements,
  isOpen,
  onClose,
}: AnnouncementModalProps) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [closeBtnHover, setCloseBtnHover] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);
  useEffect(() => { if (isOpen) setIndex(0); }, [isOpen]);

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => Math.max(0, Math.min(announcements.length - 1, i + dir)));
    setAnimKey((k) => k + 1);
  }, [announcements.length]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, go, onClose]);

  if (!isOpen || !announcements.length) return null;

  const item = announcements[index];
  const hasMultiple = announcements.length > 1;

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Announcement">
      <div style={styles.modal}>
        {/* shimmer top bar */}
        <div style={styles.shimmer} />

        {/* header */}
        <div style={styles.header}>
          <span style={styles.logo}>◈ Announce</span>
          <button
            style={{
              ...styles.closeBtn,
              background: closeBtnHover ? "rgba(120,80,255,0.15)" : styles.closeBtn.background as string,
              borderColor: closeBtnHover ? "rgba(120,80,255,0.4)" : undefined,
              color: closeBtnHover ? "#d0b8ff" : undefined,
            }}
            onClick={onClose}
            onMouseEnter={() => setCloseBtnHover(true)}
            onMouseLeave={() => setCloseBtnHover(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* card content */}
        <div
          key={animKey}
          style={{ ...styles.card, animation: "fadeSlide 0.3s ease" }}
        >
          {item.tag && (
            <div style={styles.tag}>
              <span style={styles.tagDot} />
              {item.tag}
            </div>
          )}
          <h2 style={styles.title}>{item.title}</h2>
          <p style={styles.body}>{item.body}</p>
          {item.date && <span style={styles.date}>{item.date}</span>}
          {item.cta && (
            item.cta.href ? (
              <a
                href={item.cta.href}
                style={{
                  ...styles.cta,
                  boxShadow: ctaHover ? "0 6px 28px rgba(124,77,255,0.55)" : styles.cta.boxShadow as string,
                  transform: ctaHover ? "translateY(-1px)" : undefined,
                }}
                onMouseEnter={() => setCtaHover(true)}
                onMouseLeave={() => setCtaHover(false)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.cta.label} →
              </a>
            ) : (
              <button
                style={{
                  ...styles.cta,
                  boxShadow: ctaHover ? "0 6px 28px rgba(124,77,255,0.55)" : styles.cta.boxShadow as string,
                  transform: ctaHover ? "translateY(-1px)" : undefined,
                }}
                onMouseEnter={() => setCtaHover(true)}
                onMouseLeave={() => setCtaHover(false)}
                onClick={item.cta.onClick}
              >
                {item.cta.label} →
              </button>
            )
          )}
        </div>

        {/* footer */}
        {hasMultiple && (
          <div style={styles.footer}>
            <div style={styles.dots}>
              {announcements.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to announcement ${i + 1}`}
                  onClick={() => { setIndex(i); setAnimKey((k) => k + 1); }}
                  style={{
                    width: i === index ? "20px" : "6px",
                    height: "6px",
                    borderRadius: "999px",
                    background: i === index ? "#7c4dff" : "rgba(120,80,255,0.2)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all 0.3s ease",
                    boxShadow: i === index ? "0 0 8px #7c4dff" : "none",
                  }}
                />
              ))}
            </div>
            <div style={styles.navBtns}>
              <button
                style={{
                  ...styles.navBtn,
                  opacity: index === 0 ? 0.3 : 1,
                  cursor: index === 0 ? "not-allowed" : "pointer",
                }}
                onClick={() => go(-1)}
                disabled={index === 0}
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                style={{
                  ...styles.navBtn,
                  opacity: index === announcements.length - 1 ? 0.3 : 1,
                  cursor: index === announcements.length - 1 ? "not-allowed" : "pointer",
                }}
                onClick={() => go(1)}
                disabled={index === announcements.length - 1}
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

