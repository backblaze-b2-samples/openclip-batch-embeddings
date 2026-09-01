"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useJob } from "@/lib/queries";
import { JobForm } from "./job-form";

export function EditJob({ id }: { id: string }) {
  const { data: job, isLoading, error, refetch } = useJob(id);

  if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl rounded-md" />;
  if (error) return <ErrorState error={error} title="Couldn't load job" onRetry={() => refetch()} />;
  if (!job) return null;

  return <JobForm mode="edit" job={job} />;
}
