import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { context, conversationHistory, systemPrompt, apiKey, model } = requestBody;

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

    // Call Gemini API with streaming
    const selectedModel = model || "gemini-flash-latest";
    console.log("Calling Gemini API with streaming...", { model: selectedModel });
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
        model: selectedModel,
      });
      
      // Extract error message - handle both array and object formats
      let errorMessage = "Failed to generate question";
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
          model: selectedModel,
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
        let accumulatedText = "";
        let lastSentQuestion = "";
        let lastSentOptions: string[] = [];
        let hasReceivedData = false;

        if (!reader) {
          console.error("[API] No reader available for response body");
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[API] Stream reader done. Has received data:", hasReceivedData, "Accumulated text length:", accumulatedText.length);
              break;
            }
            
            hasReceivedData = true;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete JSON objects (one per line)
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              // Try to extract text from JSON structure using string manipulation first
              // This handles incomplete JSON better than trying to parse
              let text = null;
              
              // Try to parse as JSON first
              try {
                const data = JSON.parse(trimmedLine);
                text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              } catch (parseError) {
                // If parsing fails, try to extract text using regex
                // Look for the text field in the JSON structure
                const textMatch = trimmedLine.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
                if (textMatch && textMatch[1]) {
                  text = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
                } else {
                  // Skip this line if we can't extract text
                  continue;
                }
              }

              if (text) {
                accumulatedText += text;
                console.log(`[API] Received text chunk (${text.length} chars). Total accumulated: ${accumulatedText.length} chars`);

                // Extract question using string manipulation - be more aggressive with partial matches
                let question = null;
                // First try to find "question": pattern
                const questionKeyMatch = accumulatedText.match(/"question"\s*:\s*"/);
                if (questionKeyMatch) {
                  // We found the question key, now extract everything after the opening quote
                  const questionStart = questionKeyMatch.index! + questionKeyMatch[0].length;
                  const questionText = accumulatedText.substring(questionStart);
                  
                  // Try to find closing quote (complete question)
                  const closingQuoteIndex = questionText.indexOf('"');
                  if (closingQuoteIndex !== -1) {
                    // Complete question found
                    question = questionText.substring(0, closingQuoteIndex).replace(/\\"/g, '"').replace(/\\n/g, '\n');
                    console.log(`[API] Complete question extracted (${question.length} chars): ${question.substring(0, 100)}...`);
                  } else {
                    // Partial question - take everything we have
                    question = questionText.replace(/\\"/g, '"').replace(/\\n/g, '\n');
                    console.log(`[API] Partial question extracted (${question.length} chars): ${question.substring(0, 100)}...`);
                  }
                }

                // Extract options using string manipulation
                let options: string[] = [];
                const optionsKeyMatch = accumulatedText.match(/"options"\s*:\s*\[/);
                if (optionsKeyMatch) {
                  const optionsStart = optionsKeyMatch.index! + optionsKeyMatch[0].length;
                  const optionsText = accumulatedText.substring(optionsStart);
                  
                  // Try to find closing bracket
                  const closingBracketIndex = optionsText.indexOf(']');
                  if (closingBracketIndex !== -1) {
                    // Complete options array found
                    const optionsContent = optionsText.substring(0, closingBracketIndex);
                    const optionRegex = /"((?:[^"\\]|\\.)*)"/g;
                    let match;
                    while ((match = optionRegex.exec(optionsContent)) !== null) {
                      if (match[1]) {
                        options.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
                      }
                    }
                    console.log(`[API] Complete options extracted: ${options.length} options`);
                  } else {
                    // Partial options - try to extract what we can
                    const optionRegex = /"((?:[^"\\]|\\.)*)"/g;
                    let match;
                    const seenOptions = new Set<string>();
                    while ((match = optionRegex.exec(optionsText)) !== null) {
                      if (match[1] && !seenOptions.has(match[1])) {
                        options.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
                        seenOptions.add(match[1]);
                      }
                    }
                    if (options.length > 0) {
                      console.log(`[API] Partial options extracted: ${options.length} options`);
                    }
                  }
                }

                // Stream MCQ data if we have new question or options to send
                const hasNewQuestion = question !== null && question !== lastSentQuestion;
                const hasNewOptions = options.length > 0 && JSON.stringify(options) !== JSON.stringify(lastSentOptions);
                
                if (hasNewQuestion || hasNewOptions) {
                  const mcqData: { question?: string; options?: string[] } = {};
                  if (question !== null) {
                    mcqData.question = question;
                    lastSentQuestion = question;
                  }
                  if (options.length > 0) {
                    mcqData.options = options;
                    lastSentOptions = [...options];
                  }
                  console.log(`[API] Streaming MCQ data:`, {
                    hasQuestion: !!mcqData.question,
                    questionLength: mcqData.question?.length || 0,
                    optionsCount: mcqData.options?.length || 0,
                  });
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ type: "mcq", ...mcqData })}\n\n`)
                  );
                }
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
              accumulatedText += text;
              console.log(`[API] Processed remaining buffer, added ${text.length} chars`);
            }
          }

          // Try to extract final question and options from accumulated text
          console.log(`[API] Stream complete. Final accumulated text length: ${accumulatedText.length} chars`);
          console.log(`[API] Final accumulated text (first 500 chars):`, accumulatedText.substring(0, 500));
          console.log(`[API] Final accumulated text (last 500 chars):`, accumulatedText.substring(Math.max(0, accumulatedText.length - 500)));
          if (accumulatedText.length === 0) {
            console.error("[API] WARNING: No text accumulated from stream!");
          }
          
          // Remove markdown code blocks if present
          let jsonText = accumulatedText.trim();
          if (jsonText.startsWith("```")) {
            console.log(`[API] Removing markdown code blocks`);
            const jsonLines = jsonText.split("\n");
            jsonLines.shift();
            jsonLines.pop();
            jsonText = jsonLines.join("\n").trim();
          }

          // Extract final question
          const finalQuestionMatch = jsonText.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const finalQuestion = finalQuestionMatch ? finalQuestionMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null;
          console.log(`[API] Final question extraction:`, {
            matchFound: !!finalQuestionMatch,
            questionLength: finalQuestion?.length || 0,
            questionPreview: finalQuestion?.substring(0, 100) || "null",
          });

          // Extract final options
          const finalOptionsMatch = jsonText.match(/"options"\s*:\s*\[([\s\S]*?)\]/);
          let finalOptions: string[] = [];
          if (finalOptionsMatch) {
            console.log(`[API] Final options match found. Content length: ${finalOptionsMatch[1].length} chars`);
            const optionsContent = finalOptionsMatch[1];
            const optionRegex = /"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = optionRegex.exec(optionsContent)) !== null) {
              finalOptions.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
            }
            console.log(`[API] Final options extracted: ${finalOptions.length} options`);
          } else {
            console.log(`[API] No final options match found`);
          }

          // Send final MCQ data
          if (finalQuestion || finalOptions.length > 0) {
            const finalMcqData: { question?: string; options?: string[] } = {};
            if (finalQuestion) {
              finalMcqData.question = finalQuestion;
            }
            if (finalOptions.length > 0) {
              finalMcqData.options = finalOptions;
            }
            console.log(`[API] Sending final MCQ data:`, {
              hasQuestion: !!finalMcqData.question,
              questionLength: finalMcqData.question?.length || 0,
              optionsCount: finalMcqData.options?.length || 0,
            });
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ type: "mcq", ...finalMcqData })}\n\n`)
            );
          } else {
            console.log(`[API] WARNING: No final question or options to send!`);
          }

          // Log final state before sending done signal
          console.log("[API] Stream processing complete. Final state:", {
            accumulatedTextLength: accumulatedText.length,
            hasQuestion: !!lastSentQuestion,
            questionLength: lastSentQuestion.length,
            hasOptions: lastSentOptions.length > 0,
            optionsCount: lastSentOptions.length,
            hasReceivedData: hasReceivedData,
          });

          // Send completion signal
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("[API] Stream processing error:", error);
          console.error("[API] Error details:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            model: selectedModel,
          });
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
    console.error("Error generating question:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        errorDetails: error instanceof Error ? { message: error.message, stack: error.stack } : {},
      },
      { status: 500 }
    );
  }
}

