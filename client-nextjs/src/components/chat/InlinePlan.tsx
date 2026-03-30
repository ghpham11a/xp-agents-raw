"use client";

import { useState } from "react";
import { useRunData } from "@/hooks/useRunData";
import Collapsible from "@/components/ui/Collapsible";
import PlanView from "@/components/plan/PlanView";
import FileViewer from "@/components/plan/FileViewer";
import type { ToolCallRecord } from "@/lib/types";

interface InlinePlanProps {
  runId: string;
  toolCalls?: ToolCallRecord[] | null;
}

export default function InlinePlan({ runId, toolCalls }: InlinePlanProps) {
  const { plan, files, loaded } = useRunData(runId);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const hasToolCalls = toolCalls && toolCalls.length > 0;

  if (!loaded) return null;
  if (!plan && files.length === 0 && !hasToolCalls) return null;

  return (
    <div className="mt-3 border-t border-od-border-light pt-2 space-y-2">
      {/* Plan toggle */}
      {plan && (
        <Collapsible title="Plan">
          <div className="mt-2">
            <PlanView plan={plan} />
          </div>
        </Collapsible>
      )}

      {/* Tool calls toggle */}
      {hasToolCalls && (
        <Collapsible title="Tool Calls" count={toolCalls!.length}>
          <div className="mt-2 space-y-1">
            {toolCalls!.map((tc, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-od-muted pl-2">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-od-green" />
                <span>
                  <span className="font-mono text-od-green">{tc.tool}</span>
                  {"path" in tc.input && tc.input.path != null && (
                    <span className="text-od-muted ml-1">({String(tc.input.path)})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Output files toggle */}
      {files.length > 0 && (
        <Collapsible title="Output Files" count={files.length}>
          <div className="mt-2 space-y-1">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelectedFile(selectedFile === f.path ? null : f.path)}
                className={`w-full text-left text-xs font-mono px-3 py-1.5 rounded transition-colors ${
                  selectedFile === f.path
                    ? "bg-od-bg-highlight text-od-text-bright"
                    : "text-od-muted hover:bg-od-bg-light hover:text-od-text"
                }`}
              >
                {f.path}
              </button>
            ))}

            {selectedFile && (
              <div className="mt-2">
                <FileViewer
                  runId={runId}
                  filePath={selectedFile}
                  onClose={() => setSelectedFile(null)}
                />
              </div>
            )}
          </div>
        </Collapsible>
      )}
    </div>
  );
}
