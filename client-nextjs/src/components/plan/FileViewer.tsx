"use client";

import { useCallback, useEffect, useState } from "react";
import { readRunFile } from "@/lib/api";

interface FileViewerProps {
  runId: string | null;
  filePath: string;
  liveContent?: string;
  onClose: () => void;
}

export default function FileViewer({ runId, filePath, liveContent, onClose }: FileViewerProps) {
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If we have live content from the stream, use it directly.
  // Otherwise fall back to fetching from the API (post-run).
  const content = liveContent ?? fetchedContent;

  const fetchFile = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const result = await readRunFile(runId, filePath);
      setFetchedContent(result.content);
    } catch {
      setFetchedContent("Failed to load file.");
    } finally {
      setLoading(false);
    }
  }, [runId, filePath]);

  useEffect(() => {
    if (liveContent == null && runId) {
      fetchFile();
    }
  }, [liveContent, runId, fetchFile]);

  return (
    <div className="border border-od-border-light rounded overflow-hidden bg-od-bg">
      {/* Header — VS Code tab style */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-od-bg-dark border-b border-od-border">
        <span className="text-xs font-mono text-od-text truncate">{filePath}</span>
        <button
          onClick={onClose}
          className="text-od-muted hover:text-od-text text-sm transition-colors ml-2"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        {loading && content == null ? (
          <div className="text-xs text-od-muted">Loading...</div>
        ) : (
          <pre className="text-xs text-od-text font-mono whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
