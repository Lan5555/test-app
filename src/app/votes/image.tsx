"use client";

import { ImageIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { votingImageUrl } from "./service";
import "./images.css";

export function VotingImage({
  src,
  alt,
  className = "",
  fallback,
  priority = false,
  local = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  priority?: boolean;
  local?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = local && src?.startsWith("blob:") ? src : votingImageUrl(src);
  return (
    <div
      className={`voting-image ${className}`}
      data-image-fallback={!url || failed === url || undefined}
    >
      {url && failed !== url ? (
        // biome-ignore lint/performance/noImgElement: Backend-managed public image hosts also support legacy approved hosts; no browser Cloudinary configuration is required.
        <img
          src={url}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(url)}
        />
      ) : (
        fallback || (
          <span className="voting-image-empty" aria-hidden="true">
            <ImageIcon size={28} />
          </span>
        )
      )}
    </div>
  );
}

export function CandidatePortrait({
  src,
  name,
  className = "",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";
  return (
    <VotingImage
      src={src}
      alt={`Portrait of ${name}`}
      className={className}
      fallback={
        <div className="vote-initial-avatar" aria-hidden="true">
          <span>{initials}</span>
        </div>
      }
    />
  );
}
