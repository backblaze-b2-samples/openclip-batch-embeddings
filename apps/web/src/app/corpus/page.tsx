import { CorpusGallery } from "@/components/corpus/corpus-gallery";

export default function CorpusPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Corpus</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          The source images the pipeline embeds, under the <code>corpus/</code> prefix
          in Backblaze B2. This is the sample-scoped gallery; the{" "}
          <a href="/files" className="underline">Files</a> page browses the whole bucket.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <CorpusGallery />
      </div>
    </div>
  );
}
