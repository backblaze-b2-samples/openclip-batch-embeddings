"use client";

import { SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchHit } from "@openclip-batch-embeddings/shared";
import { formatScore } from "@/lib/format";

interface ResultsGridProps {
  hits: SearchHit[];
  isPending: boolean;
  /** Shown when a search has run and returned nothing. */
  searched: boolean;
}

export function ResultsGrid({ hits, isPending, searched }: ResultsGridProps) {
  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (searched && hits.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="No matches found"
          description="Try a different description, or embed more images into this job's corpus."
        />
      </Card>
    );
  }

  if (hits.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {hits.map((hit) => (
        <Card key={hit.key} className="overflow-hidden card-hover">
          <div className="relative aspect-square bg-muted">
            {hit.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.image_url}
                alt={hit.key}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No preview
              </div>
            )}
            <Badge className="absolute top-2 right-2 bg-background/90 text-foreground shadow-sm">
              {formatScore(hit.score)} match
            </Badge>
          </div>
          <div className="p-3">
            <p className="truncate font-mono text-xs text-muted-foreground" title={hit.key}>
              {hit.key}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
