import { EditJob } from "@/components/jobs/edit-job";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Edit Job</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Rename or annotate the job. Model, precision, source, and shard size are
          editable only while the job is a draft.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <EditJob id={id} />
      </div>
    </div>
  );
}
