"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobs } from "@/lib/queries";
import { modelLabel } from "@/lib/format";

const TOP_K = [4, 8, 12, 24];

export interface SearchArgs {
  jobId: string;
  query: string;
  k: number;
}

interface SearchFormProps {
  defaultJobId?: string;
  onSearch: (args: SearchArgs) => void;
  isPending: boolean;
}

export function SearchForm({ defaultJobId, onSearch, isPending }: SearchFormProps) {
  const { data: jobs = [] } = useJobs();
  const completed = jobs.filter((j) => j.status === "complete");

  const [jobId, setJobId] = useState(defaultJobId ?? "");
  const [query, setQuery] = useState("");
  const [k, setK] = useState(12);

  const canSubmit = jobId.length > 0 && query.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSearch({ jobId, query: query.trim(), k });
  };

  if (completed.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No completed jobs to search yet.{" "}
          <Link href="/jobs" className="underline">
            Create and run a job
          </Link>{" "}
          to build a searchable index.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>Job index</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a completed job" />
              </SelectTrigger>
              <SelectContent>
                {completed.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.name} · {modelLabel(j.model)} · {j.vector_count} vectors
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Results</Label>
            <Select value={String(k)} onValueChange={(v) => setK(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_K.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Top {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-query">Describe what you&apos;re looking for</Label>
          <Input
            id="search-query"
            placeholder="e.g. a teal running shoe on a white background"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit || isPending}>
            <Search className="h-4 w-4" />
            {isPending ? "Searching..." : "Search"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
