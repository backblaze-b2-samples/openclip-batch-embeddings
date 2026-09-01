"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/queries";

const chartConfig = {
  items_per_second: { label: "Images / sec", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ThroughputChart() {
  const { data, isLoading } = useDashboard();

  const points = useMemo(
    () =>
      (data?.throughput ?? []).map((t) => ({
        name: t.name.length > 14 ? `${t.name.slice(0, 13)}…` : t.name,
        items_per_second: t.items_per_second,
      })),
    [data],
  );

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Embedding Throughput</CardTitle>
        <CardDescription className="text-xs">Images/sec per completed job</CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : points.length === 0 ? (
          <EmptyState
            icon={Gauge}
            title="No runs yet"
            description="Run a job to see its embedding throughput here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={points} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="throughput-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-items_per_second)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-items_per_second)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis allowDecimals={true} tickLine={false} axisLine={false} tickMargin={6} fontSize={11} width={32} />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="items_per_second"
                fill="url(#throughput-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
