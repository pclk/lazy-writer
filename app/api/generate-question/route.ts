import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { context, conversationHistory, systemPrompt, apiKey } = requestBody;

    // Log the incoming request
    console.log("=== Generate Question API Request ===");
    console.log("Request body:", JSON.stringify(requestBody, null, 2));
    console.log("Context:", context);
    console.log("Context type:", typeof context);
    console.log("Context length:", context?.length);
    console.log("Conversation history:", conversationHistory);
    console.log("System prompt present:", !!systemPrompt);
    console.log("API key present:", !!apiKey);

    if (!apiKey || typeof apiKey !== "string") {
      console.error("API key validation failed");
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!context || typeof context !== "string") {
      console.error("Context validation failed - context:", context, "type:", typeof context);
      return NextResponse.json(
        { error: "Context is required" },
        { status: 400 }
      );
    }

    // Load system prompt - prefer provided one, otherwise load from file
    let prompt = systemPrompt;
    if (!prompt) {
      try {
        const filePath = join(process.cwd(), "data", "question_prompt.txt");
        prompt = await readFile(filePath, "utf-8");
      } catch (error) {
        console.error("Error reading question prompt file:", error);
        return NextResponse.json(
          { error: "Failed to load system prompt" },
          { status: 500 }
        );
      }
    }

    // Build the full context with conversation history
    let fullContext = context;
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((item: { question: string; answer: string; options?: string[]; selectedIndices?: number[]; freeText?: string }) => {
          let historyEntry = `Q: ${item.question}\nA: ${item.answer}`;
          
          // Include non-selected options if available
          if (item.options && Array.isArray(item.selectedIndices)) {
            const nonSelectedOptions = item.options
              .filter((_, idx) => !item.selectedIndices!.includes(idx))
              .join(", ");
            
            if (nonSelectedOptions) {
              historyEntry += `\nNot selected: ${nonSelectedOptions}`;
            }
          }
          
          return historyEntry;
        })
        .join("\n\n");
      fullContext = `${context}\n\nPrevious questions and answers:\n${historyText}`;
    }

    // Replace {Context} placeholder with actual context
    const finalPrompt = prompt.replace(/{Context}/g, fullContext);

    console.log("=== Final Prompt ===");
    console.log("Full context:", fullContext);
    console.log("Final prompt length:", finalPrompt.length);
    console.log("Final prompt preview:", finalPrompt);

    // Call Gemini API
    console.log("Calling Gemini API...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error?.message || "Failed to generate question",
        },
        { status: 200 } // Return 200 so client can handle the error message
      );
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("=== Gemini API Response ===");
    console.log("Response status:", response.status);
    console.log("Response text length:", responseText.length);
    console.log("Response text preview:", responseText.substring(0, 500));

    if (!responseText) {
      console.error("No response text from Gemini");
      return NextResponse.json(
        { error: "No response from Gemini" },
        { status: 200 }
      );
    }

    // Parse JSON from response - handle markdown code blocks
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      // Remove first line (```json or ```)
      lines.shift();
      // Remove last line (```)
      lines.pop();
      jsonText = lines.join("\n").trim();
    }

    // Try to parse JSON
    let mcqData;
    try {
      mcqData = JSON.parse(jsonText);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          mcqData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse JSON from response:", responseText);
          return NextResponse.json(
            { error: "Failed to parse MCQ response. Please try again." },
            { status: 200 }
          );
        }
      } else {
        console.error("No JSON found in response:", responseText);
        return NextResponse.json(
          { error: "Invalid response format. Please try again." },
          { status: 200 }
        );
      }
    }

    // Validate MCQ structure
    if (!mcqData.question || !Array.isArray(mcqData.options) || mcqData.options.length === 0) {
      console.error("Invalid MCQ structure:", mcqData);
      return NextResponse.json(
        { error: "Invalid MCQ format received" },
        { status: 200 }
      );
    }

    console.log("=== MCQ Data Parsed Successfully ===");
    console.log("Question:", mcqData.question);
    console.log("Options count:", mcqData.options.length);

    return NextResponse.json({
      question: mcqData.question,
      options: mcqData.options,
    });
  } catch (error) {
    console.error("Error generating question:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 200 }
    );
  }
}

