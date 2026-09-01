"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDuration, modelLabel } from "@/lib/format";

export function RecentJobsTable() {
  const { data: jobs = [], isLoading, error, refetch } = useJobs();
  const recent = jobs.slice(0, 8);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent Jobs</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No jobs yet"
            description="Create a job or run the seed script to populate the pipeline."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[32%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Job
                </TableHead>
                <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="w-[16%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vectors
                </TableHead>
                <TableHead className="w-[34%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((job) => (
                <TableRow key={job.id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <Link
                      href={`/jobs/${encodeURIComponent(job.id)}`}
                      className="block truncate hover:underline"
                    >
                      {job.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {job.vector_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate" title={modelLabel(job.model)}>
                    {modelLabel(job.model)} · {formatDuration(job.duration_seconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
