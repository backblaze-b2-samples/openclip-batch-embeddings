"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { searchJob, ApiError } from "@/lib/api-client";
import { SearchForm, type SearchArgs } from "@/components/search/search-form";
import { ResultsGrid } from "@/components/search/results-grid";
import { ErrorState } from "@/components/ui/error-state";

function SearchInner() {
  const params = useSearchParams();
  const defaultJobId = params.get("job") ?? undefined;

  const mutation = useMutation({
    mutationFn: (a: SearchArgs) => searchJob(a.jobId, a.query, a.k),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Search failed"),
  });

  const response = mutation.data;

  return (
    <>
      <div className="animate-fade-in-up stagger-2">
        <SearchForm
          defaultJobId={defaultJobId}
          onSearch={(a) => mutation.mutate(a)}
          isPending={mutation.isPending}
        />
      </div>

      {mutation.isError && !mutation.isPending && (
        <ErrorState error={mutation.error as Error} onRetry={() => mutation.reset()} />
      )}

      <div className="animate-fade-in-up stagger-3">
        {response && !mutation.isPending && (
          <p className="mb-3 text-sm text-muted-foreground">
            {response.count} result{response.count === 1 ? "" : "s"} for &ldquo;
            {response.query}&rdquo;
          </p>
        )}
        <ResultsGrid
          hits={response?.hits ?? []}
          isPending={mutation.isPending}
          searched={mutation.isSuccess}
        />
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Semantic Search</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Type a description and get the nearest corpus images from a job&apos;s FAISS
          index. Query and images are embedded into the same OpenCLIP space and ranked
          by cosine similarity — all streamed from Backblaze B2.
        </p>
      </div>
      <Suspense>
        <SearchInner />
      </Suspense>
    </div>
  );
}
