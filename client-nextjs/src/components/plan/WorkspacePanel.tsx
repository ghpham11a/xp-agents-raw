"use client";

import { useState } from "react";
import type { Plan, FileInfo, ToolCall } from "@/lib/types";
import { WindowIcon } from "@/components/icons";
import Collapsible from "@/components/ui/Collapsible";
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

  return (
    <div className="flex flex-col h-full bg-od-bg-dark border-l border-od-border">
      {/* Workspace header — VS Code style */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-od-border shrink-0">
        <span className="text-[11px] font-medium uppercase tracking-wider text-od-muted">
          Workspace
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Plan section */}
        <Collapsible title="Plan" defaultOpen>
          <div className="px-4 py-3">
            {plan ? (
              <PlanView plan={plan} />
            ) : (
              <div className="text-xs text-od-muted italic">
                No plan yet. Send a message to start.
              </div>
            )}
          </div>
        </Collapsible>

        {/* Tool calls section */}
        {toolCalls.length > 0 && (
          <Collapsible title="Tool Calls" count={toolCalls.length} defaultOpen borderTop>
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
          </Collapsible>
        )}

        {/* Files section */}
        {files.length > 0 && (
          <Collapsible title="Files" count={files.length} defaultOpen borderTop>
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
                      <WindowIcon className="text-od-muted mr-1.5 shrink-0" />
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
          </Collapsible>
        )}
      </div>
    </div>
  );
}
