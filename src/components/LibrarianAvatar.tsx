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
      {/* Avatar circle with book icon */}
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          bg-amber-100 text-amber-800
          border-2 border-amber-300
          transition-all duration-300
          ${pulseActive ? "animate-pulse ring-2 ring-amber-400 ring-opacity-50" : ""}
          ${speaking ? "shadow-lg shadow-amber-200" : ""}
        `}
        title="London Librarian"
      >
        {/* Book/Library icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
        </svg>
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
