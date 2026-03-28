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
  runId: string | null;
}

export default function PlanPanel({
  plan,
  planStreamText,
  isStreaming,
  files,
  runId,
}: PlanPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const hasPlanContent = plan || planStreamText;

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Plan section */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Plan
          </h2>

          {/* Streaming plan text */}
          {planStreamText && (
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-xs font-mono text-zinc-300 leading-relaxed">
              <StreamingText text={planStreamText} isStreaming={isStreaming} />
            </div>
          )}

          {/* Structured plan */}
          {plan && <PlanView plan={plan} />}

          {/* Empty state */}
          {!hasPlanContent && (
            <div className="text-sm text-zinc-600 italic">
              No plan yet. Send a message to start.
            </div>
          )}
        </div>

        {/* Output files section */}
        {files.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Output Files
            </h2>

            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setSelectedFile(selectedFile === f.path ? null : f.path)}
                    className={`w-full text-left text-xs font-mono px-3 py-2 rounded-lg transition-colors ${
                      selectedFile === f.path
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {f.path}
                  </button>
                </li>
              ))}
            </ul>

            {/* File viewer */}
            {selectedFile && runId && (
              <div className="mt-3">
                <FileViewer
                  runId={runId}
                  filePath={selectedFile}
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
