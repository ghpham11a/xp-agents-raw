/**
 * Shared SVG icon components.
 *
 * Centralizes all inline SVGs so that component files stay
 * focused on layout and logic rather than raw SVG markup.
 * Every icon accepts an optional `className` for sizing/color.
 */

interface IconProps {
  className?: string;
  width?: number;
  height?: number;
}

export function WindowIcon({ className, width = 14, height = 14 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" className={className}>
      <path fill="currentColor" d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V6h12v7zm0-8H2V3h12v2z" />
    </svg>
  );
}

export function FolderIcon({ className, width = 22, height = 22 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

export function ChatBubbleIcon({ className, width = 14, height = 14 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M14 1H2a1 1 0 00-1 1v8a1 1 0 001 1h2v3.5L7.5 11H14a1 1 0 001-1V2a1 1 0 00-1-1zm0 9H7l-2 2V10H2V2h12v8z" />
    </svg>
  );
}

export function ChatBubbleLargeIcon({ className, width = 48, height = 48 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function PersonIcon({ className, width = 14, height = 14 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 00-16 0" />
    </svg>
  );
}

export function PlusIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
    </svg>
  );
}

export function CloseIcon({ className, width = 14, height = 14 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
    </svg>
  );
}

export function FileIcon({ className, width = 12, height = 12 }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zm-3 0A1.5 1.5 0 019.5 3V1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V4.5h-2z" />
    </svg>
  );
}

export function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <span
      className={`inline-block transition-transform text-[9px] ${className ?? ""}`}
      style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      &#9654;
    </span>
  );
}
