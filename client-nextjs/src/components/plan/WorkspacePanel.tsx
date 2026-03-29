"use client";

import { useState } from "react";
import type { Plan, FileInfo } from "@/lib/types";
import type { ToolCall } from "@/hooks/useAgentStream";
import PlanView from "./PlanView";
import FileViewer from "./FileViewer";

interface WorkspacePanelProps {
  plan: Plan | null;
  isStreaming: boolean;
  files: FileInfo[];
  fileContents: Record<string, string>;
  runId: string | null;
  toolCalls: ToolCall[];
}

export default function WorkspacePanel({
  plan,
  isStreaming,
  files,
  fileContents,
  runId,
  toolCalls,
}: WorkspacePanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  return (
    <div className="flex flex-col h-full bg-od-bg-dark border-l border-od-border">
      {/* Workspace header — VS Code style */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-od-border shrink-0">
        <span className="text-[11px] font-medium uppercase tracking-wider text-od-muted">
          Workspace
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Plan section — VS Code collapsible header */}
        <div>
          <button
            onClick={() => setPlanExpanded(!planExpanded)}
            className="flex items-center gap-1 w-full h-[22px] px-2 text-[11px] font-bold uppercase tracking-wider text-od-text-bright bg-od-bg-dark hover:bg-od-bg-light transition-colors"
          >
            <span
              className="inline-block transition-transform text-[9px]"
              style={{ transform: planExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              &#9654;
            </span>
            Plan
          </button>

          {planExpanded && (
            <div className="px-4 py-3">
              {plan ? (
                <PlanView plan={plan} />
              ) : (
                <div className="text-xs text-od-muted italic">
                  No plan yet. Send a message to start.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tool calls section */}
        {toolCalls.length > 0 && (
          <div>
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="flex items-center gap-1 w-full h-[22px] px-2 text-[11px] font-bold uppercase tracking-wider text-od-text-bright bg-od-bg-dark hover:bg-od-bg-light transition-colors border-t border-od-border"
            >
              <span
                className="inline-block transition-transform text-[9px]"
                style={{ transform: toolsExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                &#9654;
              </span>
              Tool Calls ({toolCalls.length})
            </button>

            {toolsExpanded && (
              <div className="py-1">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] pl-6 pr-3 h-[22px]">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-od-green" />
                    <span className="font-mono text-od-green truncate">{tc.tool}</span>
                    {"path" in tc.input && tc.input.path != null && (
                      <span className="text-od-muted text-xs truncate">({String(tc.input.path)})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files section */}
        {files.length > 0 && (
          <div>
            <button
              onClick={() => setFilesExpanded(!filesExpanded)}
              className="flex items-center gap-1 w-full h-[22px] px-2 text-[11px] font-bold uppercase tracking-wider text-od-text-bright bg-od-bg-dark hover:bg-od-bg-light transition-colors border-t border-od-border"
            >
              <span
                className="inline-block transition-transform text-[9px]"
                style={{ transform: filesExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                &#9654;
              </span>
              Files ({files.length})
            </button>

            {filesExpanded && (
              <div className="py-1">
                <ul>
                  {files.map((f) => (
                    <li key={f.path}>
                      <button
                        onClick={() => setSelectedFile(selectedFile === f.path ? null : f.path)}
                        className={`w-full text-left text-[13px] font-mono pl-6 pr-3 h-[22px] flex items-center transition-colors ${
                          selectedFile === f.path
                            ? "bg-od-bg-highlight text-od-text-bright"
                            : "text-od-muted hover:bg-od-bg-light hover:text-od-text"
                        }`}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-od-muted mr-1.5 shrink-0">
                          <path d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V6h12v7zm0-8H2V3h12v2z" />
                        </svg>
                        <span className="truncate">{f.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* File viewer */}
                {selectedFile && (
                  <div className="mt-2 mx-2">
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
        )}
      </div>
    </div>
  );
}
