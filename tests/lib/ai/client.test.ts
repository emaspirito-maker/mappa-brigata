import { describe, it, expect, vi } from "vitest";
import { generateReflection } from "@/lib/ai/client";

function fakeGeminiClient(response: unknown) {
  return {
    models: {
      generateContent: vi.fn().mockResolvedValue(response),
    },
  } as any;
}

describe("generateReflection", () => {
  it("returns the text from the response", async () => {
    const client = fakeGeminiClient({ text: "La tua riflessione." });
    const result = await generateReflection(client, { system: "sys", user: "usr" });
    expect(result).toBe("La tua riflessione.");
    expect(client.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: "usr",
        config: expect.objectContaining({ systemInstruction: "sys" }),
      })
    );
  });

  it("propagates errors from the SDK call", async () => {
    const client = {
      models: { generateContent: vi.fn().mockRejectedValue(new Error("network fail")) },
    } as any;
    await expect(
      generateReflection(client, { system: "sys", user: "usr" })
    ).rejects.toThrow("network fail");
  });
});
