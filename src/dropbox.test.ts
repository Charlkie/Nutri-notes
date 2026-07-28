import { describe, expect, it } from "vitest";
import { dropboxApiError } from "./dropbox";

describe("Dropbox API errors", () => {
  it("surfaces the structured Dropbox error summary", async () => {
    const error = await dropboxApiError(
      new Response(
        JSON.stringify({ error_summary: "path/insufficient_space/.." }),
        { status: 409 },
      ),
      "Dropbox backup upload failed",
    );
    expect(error.message).toBe(
      "Dropbox backup upload failed (409): path/insufficient_space/..",
    );
  });

  it("surfaces Dropbox plain-text request diagnostics", async () => {
    const error = await dropboxApiError(
      new Response("Dropbox-API-Arg could not decode input", { status: 400 }),
      "Dropbox backup upload failed",
    );
    expect(error.message).toContain("Dropbox-API-Arg could not decode input");
  });
});
