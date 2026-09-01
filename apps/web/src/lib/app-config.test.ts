import { describe, expect, it } from "vitest";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";

describe("app identity", () => {
  it("ships the canonical app name and description", () => {
    expect(APP_NAME).toBe("OpenCLIP Batch Embeddings");
    expect(APP_DESCRIPTION).toBe(
      "Batch image/text embedding pipeline on Backblaze B2 with OpenCLIP — shards + FAISS index in object storage."
    );
  });
});
