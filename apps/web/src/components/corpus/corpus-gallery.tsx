"use client";

import Link from "next/link";
import { Upload, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useCorpus } from "@/lib/queries";

export function CorpusGallery() {
  const { data: images = [], isLoading, error, refetch } = useCorpus();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} title="Couldn't load the corpus" onRetry={() => refetch()} />;
  }

  if (images.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Images}
          title="No corpus images yet"
          description="Upload images (they land under corpus/) or run `python scripts/seed-corpus.py` to generate a synthetic demo corpus."
          action={
            <Button asChild size="sm">
              <Link href="/upload">
                <Upload className="h-3.5 w-3.5" />
                Upload images
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {images.map((img) => (
        <Card key={img.key} className="overflow-hidden card-hover">
          <div className="aspect-square bg-muted">
            {img.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.image_url}
                alt={img.filename}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No preview
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 p-3">
            <p className="truncate text-sm font-medium" title={img.filename}>
              {img.filename}
            </p>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {img.size_human}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
