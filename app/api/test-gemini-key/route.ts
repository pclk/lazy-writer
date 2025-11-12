import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Test the API key and generate a greeting with Gemini
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
                  text: "Generate a brief, friendly greeting for a user who just set up their API key. Keep it to one sentence and introduce yourself as Gemini.",
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
          valid: false,
          error: errorData.error?.message || "Invalid API key",
        },
        { status: 200 } // Return 200 so client can handle the error message
      );
    }

    const data = await response.json();
    const greeting = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hello! Your API key is working.";
    
    return NextResponse.json({ 
      valid: true,
      greeting: greeting.trim()
    });
  } catch (error) {
    console.error("Error testing Gemini API key:", error);
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 200 }
    );
  }
}

