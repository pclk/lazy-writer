import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { context, conversationHistory, refinement, apiKey } = requestBody;

    // Log the incoming request
    console.log("=== Finalize API Request ===");
    console.log("Context:", context);
    console.log("Conversation history length:", conversationHistory?.length);
    console.log("Refinement:", refinement);
    console.log("API key present:", !!apiKey);

    if (!apiKey || typeof apiKey !== "string") {
      console.error("API key validation failed");
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!context || typeof context !== "string") {
      console.error("Context validation failed");
      return NextResponse.json(
        { error: "Context is required" },
        { status: 400 }
      );
    }

    // Load finalize prompt from file
    let prompt;
    try {
      const filePath = join(process.cwd(), "data", "finalize_prompt.txt");
      prompt = await readFile(filePath, "utf-8");
    } catch (error) {
      console.error("Error reading finalize prompt file:", error);
      return NextResponse.json(
        { error: "Failed to load finalize prompt" },
        { status: 500 }
      );
    }

    // Build the full context with conversation history (same format as generate-question)
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
    let finalPrompt = prompt.replace(/{Context}/g, fullContext);

    // Append refinement if provided
    if (refinement && typeof refinement === "string" && refinement.trim()) {
      finalPrompt += `\n\nUser's refinement request: ${refinement.trim()}\n\nPlease refine the essay/message according to the user's request above.`;
    }

    console.log("=== Final Prompt ===");
    console.log("Full context length:", fullContext.length);
    console.log("Final prompt length:", finalPrompt.length);
    console.log("Has refinement:", !!refinement);

    // Call Gemini API
    console.log("Calling Gemini API for finalization...");
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
      console.error("Gemini API error:", errorData);
      return NextResponse.json(
        {
          error: errorData.error?.message || "Failed to generate essay",
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    const essayText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("=== Gemini API Response ===");
    console.log("Essay length:", essayText.length);
    console.log("Essay preview:", essayText.substring(0, 200));

    if (!essayText) {
      console.error("No essay text from Gemini");
      return NextResponse.json(
        { error: "No response from Gemini" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      essay: essayText.trim(),
    });
  } catch (error) {
    console.error("Error finalizing essay:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 200 }
    );
  }
}

