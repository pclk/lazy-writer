import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { question, options, selectedIndices, correctIndices, context, apiKey, model } = requestBody;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!question || !options || !Array.isArray(selectedIndices) || !Array.isArray(correctIndices)) {
      return NextResponse.json(
        { error: "Question, options, selectedIndices, and correctIndices are required" },
        { status: 400 }
      );
    }

    // Build feedback prompt
    const feedbackPrompt = `You are an expert educator providing feedback on a quiz question.

Question: ${question}

Options:
${options.map((opt: string, idx: number) => `${idx}: ${opt}`).join("\n")}

Correct answer indices: ${correctIndices.join(", ")}
Student selected indices: ${selectedIndices.join(", ")}

Context: ${context || "No additional context provided"}

Please provide detailed feedback in the following JSON format:
{
    "feedback": "Overall feedback on the student's answer",
    "optionFeedback": [
        {
            "index": 0,
            "isCorrect": true/false,
            "explanation": "Why this option is correct or incorrect"
        },
        ...
    ]
}

Analyze each option and explain why it's correct or incorrect. Be encouraging but clear about mistakes.`;

    // Call Gemini API
    const selectedModel = model || "gemini-flash-latest";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
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
                  text: feedbackPrompt,
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
      
      let errorMessage = "Failed to generate feedback";
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

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to parse JSON from response (may be wrapped in markdown code blocks)
    let feedbackData: any = null;
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      lines.shift(); // Remove first line (```json or ```)
      lines.pop(); // Remove last line (```)
      jsonText = lines.join("\n").trim();
    }

    try {
      feedbackData = JSON.parse(jsonText);
    } catch (parseError) {
      // If parsing fails, create a simple feedback structure
      console.error("Failed to parse feedback JSON:", parseError);
      feedbackData = {
        feedback: text || "Feedback generated successfully.",
        optionFeedback: options.map((_: string, idx: number) => ({
          index: idx,
          isCorrect: correctIndices.includes(idx),
          explanation: correctIndices.includes(idx) 
            ? "This is a correct answer." 
            : "This is not a correct answer.",
        })),
      };
    }

    return NextResponse.json({
      feedback: feedbackData.feedback || text,
      optionFeedback: feedbackData.optionFeedback || [],
      correctIndices: correctIndices,
    });
  } catch (error) {
    console.error("Error generating quiz feedback:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
