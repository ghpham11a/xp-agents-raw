"use client";

import { useState } from "react";
import type { Plan, FileInfo } from "@/lib/types";
import PlanView from "./PlanView";
import FileViewer from "./FileViewer";
import StreamingText from "../chat/StreamingText";

interface PlanPanelProps {
  plan: Plan | null;
  planStreamText: string;
  isStreaming: boolean;
  files: FileInfo[];
  fileContents: Record<string, string>;
  runId: string | null;
}

export default function PlanPanel({
  plan,
  planStreamText,
  isStreaming,
  files,
  fileContents,
  runId,
}: PlanPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const hasPlanContent = plan || planStreamText;

  return (
    <div className="flex flex-col h-full bg-od-bg-dark border-l border-od-border">
      {/* Panel header — VS Code style tab */}
      <div className="px-4 py-2 border-b border-od-border bg-od-bg-dark">
        <span className="text-xs font-mono uppercase tracking-wider text-od-muted">Scratchpad</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Plan section */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-od-muted mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-od-blue" />
            Plan
          </h2>

          {/* Streaming plan text */}
          {planStreamText && (
            <div className="rounded bg-od-bg border border-od-border-light p-3 text-xs font-mono text-od-text leading-relaxed">
              <StreamingText text={planStreamText} isStreaming={isStreaming} />
            </div>
          )}

          {/* Structured plan */}
          {plan && <PlanView plan={plan} />}

          {/* Empty state */}
          {!hasPlanContent && (
            <div className="text-xs text-od-muted italic">
              No plan yet. Send a message to start.
            </div>
          )}
        </div>

        {/* Files section */}
        {files.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-od-muted mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-od-green" />
              Files
            </h2>

            <ul className="space-y-0.5">
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setSelectedFile(selectedFile === f.path ? null : f.path)}
                    className={`w-full text-left text-xs font-mono px-3 py-1.5 rounded transition-colors ${
                      selectedFile === f.path
                        ? "bg-od-bg-highlight text-od-text-bright"
                        : "text-od-muted hover:bg-od-bg-light hover:text-od-text"
                    }`}
                  >
                    {f.path}
                  </button>
                </li>
              ))}
            </ul>

            {/* File viewer */}
            {selectedFile && (
              <div className="mt-3">
                <FileViewer
                  runId={runId}
                  filePath={selectedFile}
                  liveContent={fileContents[selectedFile]}
                  onClose={() => setSelectedFile(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
