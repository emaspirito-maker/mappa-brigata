import type { GoogleGenAI } from "@google/genai";

export async function generateReflection(
  client: GoogleGenAI,
  prompt: { system: string; user: string }
): Promise<string> {
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt.user,
    config: {
      systemInstruction: prompt.system,
      maxOutputTokens: 300,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text content returned by Gemini");
  }
  return text.trim();
}
