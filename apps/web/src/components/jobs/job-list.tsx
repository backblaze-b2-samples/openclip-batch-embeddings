"use client";

import Link from "next/link";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { JobStatusBadge } from "@/components/jobs/status-badge";
import { useJobs } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { formatDuration, modelLabel } from "@/lib/format";

export function JobList() {
  const { data: jobs = [], isLoading, error, refetch } = useJobs();

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href="/jobs/new">
            <Plus className="h-3.5 w-3.5" />
            New job
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} title="Couldn't load jobs" onRetry={() => refetch()} />
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No embedding jobs yet"
            description="Create a job, or run `python scripts/seed-corpus.py` to seed a corpus and one demo run."
            action={
              <Button asChild size="sm">
                <Link href="/jobs/new">
                  <Plus className="h-3.5 w-3.5" />
                  New job
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[26%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Job
                  </TableHead>
                  <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Model
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vectors
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="table-row-hover">
                    <TableCell className="font-medium">
                      <Link
                        href={`/jobs/${encodeURIComponent(job.id)}`}
                        className="block truncate hover:underline"
                        title={job.name}
                      >
                        {job.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate">
                      {modelLabel(job.model)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {job.vector_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDuration(job.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(job.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
