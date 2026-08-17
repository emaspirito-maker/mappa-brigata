import { describe, it, expect, vi } from "vitest";
import { callClaude } from "@/lib/ai/client";

function fakeAnthropicClient(response: unknown) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(response),
    },
  } as any;
}

describe("callClaude", () => {
  it("returns the text from the first content block", async () => {
    const client = fakeAnthropicClient({
      content: [{ type: "text", text: "La tua riflessione." }],
    });
    const result = await callClaude(client, { system: "sys", user: "usr" });
    expect(result).toBe("La tua riflessione.");
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "sys",
        messages: [{ role: "user", content: "usr" }],
      })
    );
  });

  it("propagates errors from the SDK call", async () => {
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error("network fail")) },
    } as any;
    await expect(callClaude(client, { system: "sys", user: "usr" })).rejects.toThrow("network fail");
  });
});
