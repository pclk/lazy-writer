import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get API key from query parameter or header
    const searchParams = request.nextUrl.searchParams;
    const apiKey = searchParams.get("apiKey");

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Fetch available models from Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error?.message || "Failed to fetch models",
        },
        { status: 200 } // Return 200 so client can handle the error message
      );
    }

    const data = await response.json();
    
    // Filter and format models - only include models that support generateContent
    const allModels = (data.models || [])
      .filter((model: any) => {
        // Only include models that support content generation
        const supportedMethods = model.supportedGenerationMethods || [];
        return supportedMethods.includes("generateContent") || 
               supportedMethods.includes("streamGenerateContent");
      })
      .map((model: any) => ({
        name: model.name.replace("models/", ""),
        displayName: model.displayName || model.name.replace("models/", ""),
        description: model.description || "",
        supportedMethods: model.supportedGenerationMethods || [],
      }));

    // Separate recommended models and other models
    const recommendedModels = ["gemini-flash-latest", "gemini-pro-latest"];
    const recommended = allModels.filter((m: any) => recommendedModels.includes(m.name));
    const others = allModels.filter((m: any) => !recommendedModels.includes(m.name));

    // Sort recommended models by the order specified
    recommended.sort((a: any, b: any) => {
      const indexA = recommendedModels.indexOf(a.name);
      const indexB = recommendedModels.indexOf(b.name);
      return indexA - indexB;
    });

    // Sort other models by display name
    others.sort((a: any, b: any) => {
      return a.displayName.localeCompare(b.displayName);
    });

    // Combine: recommended first, then others
    const models = [...recommended, ...others];

    return NextResponse.json({
      models: models,
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 200 }
    );
  }
}

