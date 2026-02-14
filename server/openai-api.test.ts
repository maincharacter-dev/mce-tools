import { describe, it, expect } from "vitest";
import { invokeLLM } from "./_core/llm";

describe("OpenAI API Integration", () => {
  it("should successfully call OpenAI API with custom key", async () => {
    // This test validates that the OPENAI_API_KEY is working
    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: "Say 'API key is valid' and nothing else.",
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.choices).toBeDefined();
    expect(result.choices.length).toBeGreaterThan(0);
    expect(result.choices[0].message).toBeDefined();
    expect(result.choices[0].message.content).toContain("API key is valid");
  }, 30000); // 30 second timeout for API call
});
