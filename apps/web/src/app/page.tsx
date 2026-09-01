import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PipelineStatsCards } from "@/components/dashboard/pipeline-stats-cards";
import { WriteAmplificationCard } from "@/components/dashboard/write-amplification-card";
import { ThroughputChart } from "@/components/dashboard/throughput-chart";
import { RecentJobsTable } from "@/components/dashboard/recent-jobs-table";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Batch embedding pipeline over Backblaze B2 — corpus, shards, and FAISS
            indexes.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/jobs/new">
            <Plus className="h-3.5 w-3.5" />
            New job
          </Link>
        </Button>
      </div>

      <PipelineStatsCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <ThroughputChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <WriteAmplificationCard />
        </div>
      </div>

      <div className="animate-fade-in-up stagger-5">
        <RecentJobsTable />
      </div>
    </div>
  );
}
