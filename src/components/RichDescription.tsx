"use client";

import { useState } from "react";
import Image from "next/image";

// Match absolute paths to image files
const IMAGE_PATH_RE = /((?:\/root\/\.openclaw|\/[\w/.-]+\/\.openclaw)\/(?:workspace|media)\/\S+?\.(png|jpe?g|webp|gif))/gi;
// Match MEDIA:/path/to/file pattern
const MEDIA_RE = /MEDIA:(\/\S+?\.(png|jpe?g|webp|gif))(?:\s|$)/gi;

function imageUrl(filePath: string): string {
  return `/api/media${filePath}`;
}

function ImageInline({ src }: { src: string }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <Image
        src={src}
        alt=""
        width={800}
        height={400}
        unoptimized
        onClick={() => setFullscreen(true)}
        style={{
          maxWidth: "100%",
          maxHeight: "400px",
          borderRadius: "0.5rem",
          marginTop: "0.5rem",
          cursor: "pointer",
          border: "1px solid var(--border)",
        }}
      />
      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <Image
            src={src}
            alt=""
            width={1200}
            height={800}
            unoptimized
            style={{ maxWidth: "95vw", maxHeight: "95vh", borderRadius: "0.5rem" }}
          />
        </div>
      )}
    </>
  );
}

interface RichDescriptionProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
}

export function RichDescription({ text, style, className }: RichDescriptionProps) {
  // Collect all image URLs found in the text
  const images: string[] = [];
  let cleanText = text;

  // Extract MEDIA: patterns
  cleanText = cleanText.replace(MEDIA_RE, (_match, filePath) => {
    images.push(imageUrl(filePath));
    return "";
  });

  // Extract absolute image paths
  cleanText = cleanText.replace(IMAGE_PATH_RE, (match) => {
    images.push(imageUrl(match));
    return "";
  });

  cleanText = cleanText.trim();

  return (
    <div className={className} style={style}>
      {cleanText && <p style={{ margin: 0 }}>{cleanText}</p>}
      {images.map((src, i) => (
        <ImageInline key={i} src={src} />
      ))}
    </div>
  );
}
