import { describe, expect, it } from "vitest";
import { googleApiError } from "./googleDrive";

describe("Google Drive API errors", () => {
  it("surfaces Google's structured error message", async () => {
    const error = await googleApiError(
      new Response(
        JSON.stringify({ error: { message: "Drive API has not been used" } }),
        { status: 403 },
      ),
      "Google Drive backup creation failed",
    );
    expect(error.message).toBe(
      "Google Drive backup creation failed (403): Drive API has not been used",
    );
  });

  it("surfaces plain-text diagnostics", async () => {
    const error = await googleApiError(
      new Response("Invalid multipart request", { status: 400 }),
      "Google Drive backup creation failed",
    );
    expect(error.message).toContain("Invalid multipart request");
  });
});
