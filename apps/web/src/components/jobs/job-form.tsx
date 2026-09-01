"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  MODALITIES,
  MODELS,
  PRECISIONS,
} from "@openclip-batch-embeddings/shared";
import type {
  EmbeddingJob,
  Modality,
  ModelName,
  Precision,
} from "@openclip-batch-embeddings/shared";
import { ApiError } from "@/lib/api-client";
import { modelLabel } from "@/lib/format";
import { useCreateJob, useUpdateJob } from "@/lib/queries";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000),
  model: z.enum(MODELS as unknown as [ModelName, ...ModelName[]]),
  precision: z.enum(PRECISIONS as unknown as [Precision, ...Precision[]]),
  modality: z.enum(MODALITIES as unknown as [Modality, ...Modality[]]),
  source_prefix: z.string().min(1, "A source prefix is required").max(256),
  shard_size: z.coerce
    .number()
    .int("Whole number of items")
    .min(1)
    .max(100000),
});

type FormValues = z.infer<typeof schema>;

interface JobFormProps {
  mode: "create" | "edit";
  job?: EmbeddingJob;
}

const PRECISION_LABEL: Record<Precision, string> = {
  float32: "float32 — most compatible (CPU / MPS)",
  float16: "float16 — halves shard bytes (best on CUDA)",
};

export function JobForm({ mode, job }: JobFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  // Config is immutable once a job has run — only a draft can change it.
  const configLocked = isEdit && job?.status !== "draft";

  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob(job?.id ?? "");
  const submitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: job?.name ?? "",
      description: job?.description ?? "",
      model: (job?.config.model ?? MODELS[0]) as ModelName,
      precision: (job?.config.precision ?? "float32") as Precision,
      modality: (job?.config.modality ?? "images") as Modality,
      source_prefix: job?.config.source_prefix ?? "corpus/",
      shard_size: job?.config.shard_size ?? 256,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && job) {
        const patch = configLocked
          ? { name: values.name, description: values.description }
          : values;
        await updateMutation.mutateAsync(patch);
        toast.success("Job updated");
        router.push(`/jobs/${encodeURIComponent(job.id)}`);
      } else {
        const created = await createMutation.mutateAsync(values);
        toast.success("Job created — run it to embed the corpus");
        router.push(`/jobs/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Job details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="demo-corpus-run" {...field} />
                  </FormControl>
                  {!isEdit && (
                    <FormDescription>A short label for this batch run.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Optional notes about this corpus or model."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Embedding configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {configLocked && (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Model, precision, source prefix, and shard size are locked once a
                job has run. Create a new job to embed with different settings.
              </p>
            )}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={configLocked}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-96">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {modelLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isEdit && (
                    <FormDescription>
                      OpenCLIP checkpoint used to encode. Both options are 512-d.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="precision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precision</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={configLocked}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRECISIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRECISION_LABEL[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modality</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={configLocked}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODALITIES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="source_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source prefix</FormLabel>
                    <FormControl>
                      <Input
                        className="font-mono"
                        disabled={configLocked}
                        {...field}
                      />
                    </FormControl>
                    {!isEdit && (
                      <FormDescription>
                        The folder the seed/upload populates; point at your own
                        prefix to embed a real corpus.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shard_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shard size</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="font-mono tabular-nums"
                        disabled={configLocked}
                        {...field}
                      />
                    </FormControl>
                    {!isEdit && (
                      <FormDescription>Vectors per `.npy` shard.</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save changes"
                : "Create job"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
