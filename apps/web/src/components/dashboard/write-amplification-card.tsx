"use client";

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/queries";

export function WriteAmplificationCard() {
  const { data, isLoading } = useDashboard();

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Write Amplification
        </CardTitle>
        <CardDescription className="text-xs">
          Projected embedding-shard storage at scale, from the measured{" "}
          {data ? (
            <span className="font-mono">{data.stats.bytes_per_vector} B</span>
          ) : (
            "—"
          )}{" "}
          per vector.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Items
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Projected shards
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projection.map((p) => (
                  <TableRow key={p.label} className="table-row-hover">
                    <TableCell className="font-medium">{p.label} items</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {p.projected_human}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              At 512-d, float16 stores{" "}
              <span className="font-mono">{data.float16_bytes_per_vector} B</span>/vector
              vs float32&apos;s{" "}
              <span className="font-mono">{data.float32_bytes_per_vector} B</span> —
              choosing float16 halves shard bytes.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
