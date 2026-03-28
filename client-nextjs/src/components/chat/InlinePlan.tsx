"use client";

import { useState, useEffect } from "react";
import { getRunPlan, listRunFiles } from "@/lib/api";
import PlanView from "@/components/plan/PlanView";
import FileViewer from "@/components/plan/FileViewer";
import type { Plan, FileInfo } from "@/lib/types";

interface InlinePlanProps {
  runId: string;
}

export default function InlinePlan({ runId }: InlinePlanProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(false);
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

  if (!loaded) return null;
  if (!plan && files.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-700 pt-2 space-y-2">
      {/* Plan toggle */}
      {plan && (
        <div>
          <button
            onClick={() => setPlanExpanded(!planExpanded)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span
              className="inline-block transition-transform"
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

      {/* Output files toggle */}
      {files.length > 0 && (
        <div>
          <button
            onClick={() => setFilesExpanded(!filesExpanded)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span
              className="inline-block transition-transform"
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
                  className={`w-full text-left text-xs font-mono px-3 py-2 rounded-lg transition-colors ${
                    selectedFile === f.path
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
