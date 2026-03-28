"use client";

import { useCallback, useEffect, useState } from "react";
import { readRunFile } from "@/lib/api";

interface FileViewerProps {
  runId: string;
  filePath: string;
  onClose: () => void;
}

export default function FileViewer({ runId, filePath, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFile = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readRunFile(runId, filePath);
      setContent(result.content);
    } catch {
      setContent("Failed to load file.");
    } finally {
      setLoading(false);
    }
  }, [runId, filePath]);

  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <span className="text-xs font-mono text-zinc-300 truncate">{filePath}</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-xs text-zinc-500">Loading...</div>
        ) : (
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
