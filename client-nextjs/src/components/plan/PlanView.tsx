"use client";

import type { Plan } from "@/lib/types";

interface PlanViewProps {
  plan: Plan;
}

export default function PlanView({ plan }: PlanViewProps) {
  return (
    <div className="space-y-3">
      {/* Goal */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-od-muted mb-1">Goal</h3>
        <p className="text-sm text-od-text leading-relaxed">{plan.goal}</p>
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-od-muted mb-1.5">Steps</h3>
        <ul className="space-y-1">
          {plan.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 mt-0.5 w-4 h-4 rounded border border-od-border-light flex items-center justify-center text-[10px] font-mono text-od-muted">
                {i + 1}
              </span>
              <span className="text-od-text">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Done when */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-od-muted mb-1">Done when</h3>
        <p className="text-sm text-od-muted leading-relaxed">{plan.done_when}</p>
      </div>

      {/* Output files */}
      {plan.output_files.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-od-muted mb-1">Expected outputs</h3>
          <div className="flex flex-wrap gap-1.5">
            {plan.output_files.map((f) => (
              <span key={f} className="inline-block rounded bg-od-bg border border-od-border-light px-2 py-0.5 text-xs font-mono text-od-cyan">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
