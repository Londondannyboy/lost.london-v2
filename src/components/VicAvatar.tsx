"use client";

interface VicAvatarProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  speaking?: boolean;
}

/**
 * VicAvatar - Visual indicator for VIC (Vic Keegan)
 *
 * Displays VIC's avatar with optional label and speaking animation.
 */
export function VicAvatar({
  size = "md",
  showLabel = true,
  speaking = false,
}: VicAvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Avatar with VIC's photo */}
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          overflow-hidden
          border-2 border-stone-300
          transition-all duration-300
          ${speaking ? "ring-2 ring-amber-400 ring-opacity-50 animate-pulse" : ""}
        `}
        title="VIC - Vic Keegan"
      >
        <img
          src="/vic-avatar.jpg"
          alt="VIC"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span className={`text-stone-700 font-medium ${textSizes[size]}`}>
          VIC
        </span>
      )}
    </div>
  );
}

/**
 * VicMessage - Wrapper for messages from VIC
 *
 * Provides visual distinction for VIC's text responses.
 * Note: VIC's voice responses don't need this - they're spoken.
 */
interface VicMessageProps {
  children: React.ReactNode;
}

export function VicMessage({ children }: VicMessageProps) {
  return (
    <div className="vic-message my-4">
      {/* Header with avatar */}
      <div className="flex items-center gap-2 mb-2">
        <VicAvatar size="sm" showLabel />
      </div>

      {/* Content */}
      <div className="pl-8 border-l-2 border-stone-200">{children}</div>
    </div>
  );
}

export default VicAvatar;
