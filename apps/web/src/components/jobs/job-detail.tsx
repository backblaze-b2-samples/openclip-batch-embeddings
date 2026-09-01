"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Pencil, Trash2, ArrowLeft, Search, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { JobStatusBadge } from "@/components/jobs/status-badge";
import { ApiError } from "@/lib/api-client";
import { useDeleteJob, useJob, useRunJob } from "@/lib/queries";
import { humanizeBytes } from "@/lib/utils";
import { formatDuration, modelLabel } from "@/lib/format";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: job, isLoading, error, refetch } = useJob(id);
  const runMutation = useRunJob(id);
  const deleteMutation = useDeleteJob();

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }
  if (error) {
    return <ErrorState error={error} title="Couldn't load job" onRetry={() => refetch()} />;
  }
  if (!job) return null;

  const onRun = () => {
    runMutation.mutate(undefined, {
      onSuccess: (updated) => {
        if (updated.status === "complete") {
          toast.success(`Embedded ${updated.vector_count} images`);
        } else {
          toast.error(updated.error ?? "Run failed");
        }
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Run failed"),
    });
  };

  const onDelete = () => {
    deleteMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success(`${job.name} deleted`);
        router.push("/jobs");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete job"),
    });
  };

  const running = runMutation.isPending || job.status === "running";
  const isComplete = job.status === "complete";

  // Determinate progress once the backend has published the corpus total;
  // null until then, so the bar shows an indeterminate "Starting…" state.
  const pct =
    job.image_count > 0
      ? Math.round((job.vector_count / job.image_count) * 100)
      : null;
  let stageLabel: string;
  if (job.image_count > 0 && job.vector_count < job.image_count) {
    stageLabel = `Embedding images… ${job.vector_count}/${job.image_count}`;
  } else if (job.image_count > 0) {
    stageLabel = "Building index…";
  } else {
    stageLabel = "Starting…";
  }

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/jobs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to jobs
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{job.name}</h1>
          <JobStatusBadge status={job.status} />
        </div>
        {job.description && (
          <p className="max-w-prose text-sm text-muted-foreground">{job.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRun} disabled={running}>
          <Play className="h-4 w-4" />
          {running ? "Running…" : isComplete ? "Re-run" : "Run job"}
        </Button>
        {isComplete && (
          <Button asChild variant="outline">
            <Link href={`/search?job=${encodeURIComponent(job.id)}`}>
              <Search className="h-4 w-4" />
              Search
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" disabled={running}>
          <Link href={`/jobs/${encodeURIComponent(job.id)}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={running}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this job?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <strong>{job.name}</strong>, its embedding
                shards under <code>embeddings/{job.id}/</code>, and its index under{" "}
                <code>indexes/{job.id}/</code>. The source corpus is untouched. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={deleteMutation.isPending}
                className={buttonVariants({ variant: "destructive" })}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {job.status === "failed" && job.error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{job.error}</CardContent>
        </Card>
      )}

      {running && (
        <Card className="border-[var(--chart-2)]/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--chart-2)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{stageLabel}</span>
            </div>
            <Progress
              value={pct ?? undefined}
              className={pct === null ? "animate-pulse" : ""}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border py-3 px-4">
            <CardTitle className="card-title text-sm">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-border">
            <Row label="Model" value={modelLabel(job.config.model)} />
            <Row label="Precision" value={job.config.precision} />
            <Row label="Modality" value={job.config.modality} />
            <Row label="Source prefix" value={job.config.source_prefix} mono />
            <Row label="Shard size" value={`${job.config.shard_size} vectors`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-3 px-4">
            <CardTitle className="card-title text-sm">Run artifacts</CardTitle>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-border">
            <Row label="Images embedded" value={job.vector_count.toLocaleString()} />
            <Row label="Vector dimension" value={`${job.dim}-d`} />
            <Row label="Embedding shards" value={`${job.shard_count} · ${humanizeBytes(job.shard_bytes)}`} />
            <Row label="FAISS index size" value={humanizeBytes(job.index_bytes)} />
            <Row label="Throughput" value={job.throughput_per_second ? `${job.throughput_per_second}/s` : "—"} />
            <Row label="Duration" value={formatDuration(job.duration_seconds)} />
            {job.index_key && <Row label="Index key" value={job.index_key} mono />}
          </CardContent>
        </Card>
      </div>

      {job.shard_keys.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border py-3 px-4">
            <CardTitle className="card-title text-sm">
              Embedding shards on B2 ({job.shard_keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            {job.shard_keys.map((key) => (
              <code key={key} className="block text-xs break-all text-muted-foreground">
                {key}
              </code>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
