"use client";

import { useState, useEffect } from "react";

interface LibrarianAvatarProps {
  speaking?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * LibrarianAvatar - Visual indicator when the London Librarian is "speaking"
 *
 * Displays a distinct avatar with animation when the Librarian is active.
 * Used alongside VIC's responses to clearly indicate which agent is contributing.
 */
export function LibrarianAvatar({
  speaking = false,
  size = "md",
  showLabel = true,
}: LibrarianAvatarProps) {
  const [pulseActive, setPulseActive] = useState(false);

  // Animate when speaking
  useEffect(() => {
    if (speaking) {
      setPulseActive(true);
      const timer = setTimeout(() => setPulseActive(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [speaking]);

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Avatar with Librarian image */}
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          overflow-hidden
          border-2 border-amber-300
          transition-all duration-300
          ${pulseActive ? "animate-pulse ring-2 ring-amber-400 ring-opacity-50" : ""}
          ${speaking ? "shadow-lg shadow-amber-200" : ""}
        `}
        title="London Librarian"
      >
        <img
          src="/London Librarian Avatar 1.png"
          alt="London Librarian"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={`
            text-amber-700 font-medium
            ${size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"}
          `}
        >
          London Librarian
        </span>
      )}
    </div>
  );
}

/**
 * LibrarianMessage - Wrapper for messages from the Librarian
 *
 * Provides visual distinction for Librarian responses in the chat.
 */
interface LibrarianMessageProps {
  children: React.ReactNode;
  brief?: string;
}

export function LibrarianMessage({ children, brief }: LibrarianMessageProps) {
  return (
    <div className="librarian-message my-4">
      {/* Header with avatar */}
      <div className="flex items-center gap-2 mb-2">
        <LibrarianAvatar speaking size="sm" showLabel />
      </div>

      {/* Brief summary if provided */}
      {brief && (
        <p className="text-sm text-amber-700 italic mb-2">{brief}</p>
      )}

      {/* Content (usually Generative UI components) */}
      <div className="pl-8 border-l-2 border-amber-200">{children}</div>
    </div>
  );
}

/**
 * LibrarianThinking - Loading state while Librarian is searching
 */
export function LibrarianThinking() {
  return (
    <div className="flex items-center gap-3 text-amber-600 my-4">
      <LibrarianAvatar speaking size="sm" showLabel={false} />
      <span className="text-sm animate-pulse">
        Searching the archives...
      </span>
    </div>
  );
}

export default LibrarianAvatar;
