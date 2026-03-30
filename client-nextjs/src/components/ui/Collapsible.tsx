"use client";

import { useState } from "react";
import { ChevronIcon } from "@/components/icons";

/**
 * A reusable collapsible section — the VS Code "tree header" pattern.
 *
 * Renders a clickable header bar with a rotating chevron that toggles
 * the visibility of its `children`. Used throughout the sidebar and
 * workspace panel to keep sections expandable/collapsible.
 */
interface CollapsibleProps {
  title: string;
  /** Number shown in parentheses after the title (e.g. "Files (3)") */
  count?: number;
  defaultOpen?: boolean;
  /** Show a top border — useful when stacking multiple sections */
  borderTop?: boolean;
  children: React.ReactNode;
}

export default function Collapsible({
  title,
  count,
  defaultOpen = false,
  borderTop = false,
  children,
}: CollapsibleProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1 w-full h-[22px] px-2 text-[11px] font-bold uppercase tracking-wider text-od-text-bright bg-od-bg-dark hover:bg-od-bg-light transition-colors ${
          borderTop ? "border-t border-od-border" : ""
        }`}
      >
        <ChevronIcon expanded={expanded} />
        {title}
        {count != null && ` (${count})`}
      </button>
      {expanded && children}
    </div>
  );
}
