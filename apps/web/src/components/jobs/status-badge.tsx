import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@openclip-batch-embeddings/shared";

const STATUS: Record<JobStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  running: { label: "Running", className: "bg-[var(--chart-2)]/15 text-[var(--chart-2)]" },
  complete: { label: "Complete", className: "bg-[var(--success)]/15 text-[var(--success)]" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const s = STATUS[status];
  return (
    <Badge variant="secondary" className={s.className}>
      {s.label}
    </Badge>
  );
}
