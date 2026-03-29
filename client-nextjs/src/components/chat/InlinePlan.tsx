"use client";

import { useState, useEffect } from "react";
import { getRunPlan, listRunFiles } from "@/lib/api";
import PlanView from "@/components/plan/PlanView";
import FileViewer from "@/components/plan/FileViewer";
import type { Plan, FileInfo, ToolCallRecord } from "@/lib/types";

interface InlinePlanProps {
  runId: string;
  toolCalls?: ToolCallRecord[] | null;
}

export default function InlinePlan({ runId, toolCalls }: InlinePlanProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getRunPlan(runId),
      listRunFiles(runId).catch(() => [] as FileInfo[]),
    ]).then(([p, f]) => {
      setPlan(p);
      // Filter out plan.md and state.json, only show output files
      const outputFiles = f.filter(
        (file) => file.path.startsWith("output/")
      );
      setFiles(outputFiles);
      setLoaded(true);
    });
  }, [runId]);

  const hasToolCalls = toolCalls && toolCalls.length > 0;

  if (!loaded) return null;
  if (!plan && files.length === 0 && !hasToolCalls) return null;

  return (
    <div className="mt-3 border-t border-od-border-light pt-2 space-y-2">
      {/* Plan toggle */}
      {plan && (
        <div>
          <button
            onClick={() => setPlanExpanded(!planExpanded)}
            className="flex items-center gap-1.5 text-xs text-od-muted hover:text-od-text transition-colors"
          >
            <span
              className="inline-block transition-transform text-[10px]"
              style={{ transform: planExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              &#9654;
            </span>
            Plan
          </button>
          {planExpanded && (
            <div className="mt-2">
              <PlanView plan={plan} />
            </div>
          )}
        </div>
      )}

      {/* Tool calls toggle */}
      {hasToolCalls && (
        <div>
          <button
            onClick={() => setToolsExpanded(!toolsExpanded)}
            className="flex items-center gap-1.5 text-xs text-od-muted hover:text-od-text transition-colors"
          >
            <span
              className="inline-block transition-transform text-[10px]"
              style={{ transform: toolsExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              &#9654;
            </span>
            Tool Calls ({toolCalls!.length})
          </button>
          {toolsExpanded && (
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
          )}
        </div>
      )}

      {/* Output files toggle */}
      {files.length > 0 && (
        <div>
          <button
            onClick={() => setFilesExpanded(!filesExpanded)}
            className="flex items-center gap-1.5 text-xs text-od-muted hover:text-od-text transition-colors"
          >
            <span
              className="inline-block transition-transform text-[10px]"
              style={{ transform: filesExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              &#9654;
            </span>
            Output Files ({files.length})
          </button>
          {filesExpanded && (
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
          )}
        </div>
      )}
    </div>
  );
}
