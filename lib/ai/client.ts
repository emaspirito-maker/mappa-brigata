import type Anthropic from "@anthropic-ai/sdk";

export async function callClaude(
  client: Anthropic,
  prompt: { system: string; user: string }
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text content returned by Claude");
  }
  return block.text.trim();
}
