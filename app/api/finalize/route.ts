import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { context, conversationHistory, refinement, apiKey, model } = requestBody;

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

    // Call Gemini API with streaming
    const selectedModel = model || "gemini-flash-latest";
    console.log("Calling Gemini API for finalization with streaming...", { model: selectedModel });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?key=${apiKey}`,
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
      const errorText = await response.text().catch(() => "Failed to read error response");
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.error("[API] Error response is not JSON:", errorText);
      }
      
      console.error("[API] Gemini API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        errorText: errorText,
        model: model,
      });
      
      // Extract error message - handle both array and object formats
      let errorMessage = "Failed to generate essay";
      if (Array.isArray(errorData) && errorData.length > 0) {
        errorMessage = errorData[0]?.error?.message || errorData[0]?.error || errorMessage;
      } else if (errorData?.error) {
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      }
      
      // Return proper HTTP status code based on the error
      const statusCode = response.status >= 400 && response.status < 600 ? response.status : 500;
      return NextResponse.json(
        {
          error: errorMessage,
          errorDetails: errorData,
          model: model,
        },
        { status: statusCode }
      );
    }

    // Create a readable stream to forward Gemini's stream to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete JSON objects (one per line)
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              // Try to extract text from JSON structure
              let text = null;
              
              // Try to parse as JSON first
              try {
                const data = JSON.parse(trimmedLine);
                text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              } catch (parseError) {
                // If parsing fails, try to extract text using regex
                const textMatch = trimmedLine.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
                if (textMatch && textMatch[1]) {
                  text = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
                } else {
                  // Skip this line if we can't extract text
                  continue;
                }
              }

              if (text) {
                // Stream text chunk directly to client
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`)
                );
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const trimmedBuffer = buffer.trim();
            let text = null;
            
            try {
              const data = JSON.parse(trimmedBuffer);
              text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (parseError) {
              // Try to extract text using regex
              const textMatch = trimmedBuffer.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
              if (textMatch && textMatch[1]) {
                text = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
              }
            }
            
            if (text) {
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`)
              );
            }
          }

          // Send completion signal
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorMessage = error instanceof Error ? error.message : "Stream processing failed";
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: "error", error: errorMessage, model: selectedModel })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error finalizing essay:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        errorDetails: error instanceof Error ? { message: error.message, stack: error.stack } : {},
      },
      { status: 500 }
    );
  }
}

