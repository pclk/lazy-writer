import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { context, conversationHistory, apiKey, model } = requestBody;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!context || typeof context !== "string") {
      return NextResponse.json(
        { error: "Context is required" },
        { status: 400 }
      );
    }

    // Build conversation history text
    let historyText = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyText = conversationHistory
        .map((item: any) => {
          let entry = `Question: ${item.question}\n`;
          entry += `Student Answer: ${item.answer}\n`;
          if (item.feedback) {
            entry += `Feedback: ${item.feedback}\n`;
          }
          if (item.optionFeedback) {
            entry += `Option Feedback: ${JSON.stringify(item.optionFeedback)}\n`;
          }
          return entry;
        })
        .join("\n---\n\n");
    }

    // Build analysis prompt
    const analysisPrompt = `You are an expert educator analyzing a student's quiz performance.

Context/Topic: ${context}

Quiz History:
${historyText || "No quiz history available."}

Please analyze the student's performance and provide:
1. Overall performance assessment
2. Strengths (what they did well)
3. Areas for improvement (what needs work)
4. Recommended next topics to learn (if performance is good)
5. Recommended areas to review (if performance needs improvement)

Format your response as a comprehensive analysis that is encouraging but honest.`;

    // Call Gemini API with streaming
    const selectedModel = model || "gemini-flash-latest";
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
                  text: analysisPrompt,
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
      
      let errorMessage = "Failed to generate analysis";
      if (Array.isArray(errorData) && errorData.length > 0) {
        errorMessage = errorData[0]?.error?.message || errorData[0]?.error || errorMessage;
      } else if (errorData?.error) {
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          errorDetails: errorData,
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 500 }
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
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              let text = null;
              
              try {
                const data = JSON.parse(trimmedLine);
                text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              } catch (parseError) {
                const textMatch = trimmedLine.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
                if (textMatch && textMatch[1]) {
                  text = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
                } else {
                  continue;
                }
              }

              if (text) {
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
    console.error("Error finalizing quiz:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
