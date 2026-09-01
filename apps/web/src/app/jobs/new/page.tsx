import { JobForm } from "@/components/jobs/job-form";

export default function NewJobPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">New Embedding Job</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Pick a source prefix, an OpenCLIP model, and a precision. The job starts as
          a draft; run it to embed the corpus and build a searchable index.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <JobForm mode="create" />
      </div>
    </div>
  );
}
