"use client";

import { useEffect, useState } from "react";
import { getRunPlan, listRunFiles } from "@/lib/api";
import type { Plan, FileInfo } from "@/lib/types";

interface RunData {
  plan: Plan | null;
  files: FileInfo[];
  loaded: boolean;
}

/**
 * Fetches plan and output files for a completed agent run.
 *
 * Encapsulates the async data-fetching lifecycle so consuming
 * components can stay purely declarative.
 */
export function useRunData(runId: string): RunData {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getRunPlan(runId),
      listRunFiles(runId).catch(() => [] as FileInfo[]),
    ]).then(([p, f]) => {
      if (cancelled) return;
      setPlan(p);
      const outputFiles = f.filter((file) => file.path.startsWith("output/"));
      setFiles(outputFiles);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return { plan, files, loaded };
}
