"use client";

import { Images, Boxes, Layers, HardDrive, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useDashboard } from "@/lib/queries";

export function PipelineStatsCards() {
  const { data, isLoading, error, refetch } = useDashboard();
  const stats = data?.stats;

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { title: "Corpus Images", value: (stats?.corpus_images ?? 0).toLocaleString(), icon: Images },
    { title: "Vectors Embedded", value: (stats?.vectors_embedded ?? 0).toLocaleString(), icon: Boxes },
    {
      title: "Embedding Shards",
      value: `${stats?.shard_count ?? 0} · ${stats?.shard_bytes_human ?? "0 B"}`,
      icon: Layers,
    },
    { title: "Index Size", value: stats?.index_bytes_human ?? "0 B", icon: HardDrive },
    { title: "Jobs Run", value: (stats?.jobs_complete ?? 0).toLocaleString(), icon: PlayCircle },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, i) => (
        <Card key={card.title} className={`card-hover animate-fade-in-up stagger-${i + 1}`}>
          <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="stat-value text-lg">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
