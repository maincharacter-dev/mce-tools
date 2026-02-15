import { describe, it, expect } from "vitest";
import { invokeLLM } from "./server/_core/llm";

describe("OpenAI Integration", () => {
  it("should successfully call OpenAI API with configured key", async () => {
    // Simple test to verify the OpenAI API key is valid and working
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Respond with exactly one word.",
        },
        {
          role: "user",
          content: "Say hello",
        },
      ],
    });

    // Check that we got a valid response
    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message).toBeDefined();
    expect(response.choices[0].message.content).toBeDefined();
    expect(typeof response.choices[0].message.content).toBe("string");
    expect(response.choices[0].message.content.length).toBeGreaterThan(0);

    console.log("✓ OpenAI API integration test passed");
    console.log(
      "Response:",
      response.choices[0].message.content.substring(0, 100)
    );
  });
});
