import { JobList } from "@/components/jobs/job-list";

export default function JobsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Embedding Jobs</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Each job streams a corpus from B2, encodes it on-device with OpenCLIP, and
          writes <code>.npy</code> embedding shards plus a FAISS index back to{" "}
          <code>embeddings/</code> and <code>indexes/</code>. This is the
          sample-scoped view; the{" "}
          <a href="/files" className="underline">Files</a> page browses the whole bucket.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <JobList />
      </div>
    </div>
  );
}
