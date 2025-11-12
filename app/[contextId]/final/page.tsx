"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ConversationItem {
  question: string;
  answer: string;
  options: string[];
  selectedIndices: number[];
  freeText: string;
}

export default function FinalPage() {
  const params = useParams();
  const contextId = params.contextId as string;

  const [context, setContext] = useState("");
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [essay, setEssay] = useState("");
  const [refinement, setRefinement] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState("");
  const [errorModel, setErrorModel] = useState<string | null>(null);
  const [errorModels, setErrorModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingErrorModels, setIsLoadingErrorModels] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // Load context from localStorage
    const savedContext = localStorage.getItem(`lazy-writer-context-${contextId}`) || 
                        localStorage.getItem("lazy-writer-context");
    if (savedContext) {
      setContext(savedContext);
    }

    // Load conversation history from localStorage
    const savedHistory = localStorage.getItem(`lazy-writer-history-${contextId}`);
    if (savedHistory) {
      try {
        setConversationHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error("Error parsing conversation history:", error);
      }
    }

    // Load API key
    const savedApiKey = localStorage.getItem("lazy-writer-api-key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    // Load model - prefer finalize model, fallback to regular model
    const savedFinalizeModel = localStorage.getItem("lazy-writer-finalize-model");
    const savedModel = localStorage.getItem("lazy-writer-model");
    if (savedFinalizeModel) {
      setModel(savedFinalizeModel);
    } else if (savedModel) {
      setModel(savedModel);
    }
  }, [contextId]);

  useEffect(() => {
    // Generate initial essay when context and API key are loaded
    if (context && apiKey) {
      generateEssay();
    } else if (context && !apiKey) {
      setError("API key not found. Please go back and save your API key.");
      setIsLoading(false);
    } else if (!context) {
      setError("Context not found. Please go back and enter your context.");
      setIsLoading(false);
    }
  }, [context, apiKey]);

  const loadErrorModels = async (apiKeyToUse: string) => {
    setIsLoadingErrorModels(true);
    try {
      const response = await fetch(`/api/list-models?apiKey=${encodeURIComponent(apiKeyToUse)}`);
      const data = await response.json();
      
      if (data.error) {
        console.error("Error loading models:", data.error);
        // Fallback to default models if API call fails
        setErrorModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      } else if (data.models && data.models.length > 0) {
        setErrorModels(data.models);
        // Set error model to current model if not already set
        if (!errorModel) {
          setErrorModel(model);
        }
      } else {
        // Fallback to default models
        setErrorModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      // Fallback to default models
      setErrorModels([
        { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
        { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
      ]);
    } finally {
      setIsLoadingErrorModels(false);
    }
  };

  const generateEssay = async (refinementText?: string, modelToUse?: string) => {
    if (!apiKey || !context) {
      setError("API key and context are required");
      setIsLoading(false);
      return;
    }

    if (refinementText) {
      setIsRefining(true);
    } else {
      setIsLoading(true);
    }
    setError("");
    setCopySuccess(false);

    const selectedModel = modelToUse || model;
    try {
      const response = await fetch("/api/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: context,
          conversationHistory: conversationHistory,
          refinement: refinementText || undefined,
          apiKey: apiKey,
          model: selectedModel,
        }),
      });

      // Check if response is an error (non-OK status)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Extract error message - handle array format from Gemini API
        let errorMessage = "Failed to generate essay";
        const errorDetails = errorData.errorDetails;
        if (Array.isArray(errorDetails) && errorDetails.length > 0) {
          errorMessage = errorDetails[0]?.error?.message || errorDetails[0]?.error || errorMessage;
        } else if (errorDetails?.error) {
          errorMessage = errorDetails.error?.message || errorDetails.error || errorMessage;
        } else {
          errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}` || errorMessage;
        }
        
        setError(errorMessage);
        setErrorModel(errorData.model || model);
        setEssay("");
        setIsLoading(false);
        setIsRefining(false);
        // Load models for error UI
        if (apiKey) {
          loadErrorModels(apiKey);
        }
        return;
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) {
        setError("No response stream available");
        setEssay("");
        setIsLoading(false);
        setIsRefining(false);
        return;
      }

      // Clear essay for new generation
      if (refinementText) {
        setEssay("");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE messages
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "chunk" && data.text) {
                // Hide loading spinner as soon as we receive the first chunk
                setIsLoading(false);
                // Append text chunk to essay
                setEssay((prev) => {
                  const newEssay = prev + data.text;
                  console.log(`[Final Client] Received text chunk (${data.text.length} chars), total essay length: ${newEssay.length}`);
                  return newEssay;
                });
              } else if (data.type === "done") {
                // Streaming complete
                console.log(`[Final Client] Streaming complete`);
                if (refinementText) {
                  setRefinement("");
                }
                setIsLoading(false);
                setIsRefining(false);
                return;
              } else if (data.type === "error") {
                console.error(`[Final Client] Error received:`, data.error);
                setError(data.error || "An error occurred");
                setErrorModel(data.model || model);
                setEssay("");
                setIsLoading(false);
                setIsRefining(false);
                // Load models for error UI
                if (apiKey) {
                  loadErrorModels(apiKey);
                }
                return;
              }
            } catch (e) {
              console.error(`[Final Client] Error parsing SSE data:`, e, `Line:`, line.substring(0, 100));
              // Skip invalid JSON
            }
          }
        }
      }

      // If we get here, streaming completed
      if (refinementText) {
        setRefinement("");
      }
    } catch (error) {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate essay. Please try again.";
      setError(errorMessage);
      setEssay("");
    } finally {
      setIsLoading(false);
      setIsRefining(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(essay);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      setError("Failed to copy to clipboard");
    }
  };

  const handleRefine = () => {
    if (refinement.trim()) {
      generateEssay(refinement.trim(), model);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-6">Your Final Message</h1>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      ) : error ? (
        <div className="p-6 border-2 border-red-500/50 rounded-lg bg-red-950/20">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-red-400 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-semibold mb-2">Error Generating Essay</h3>
              <p className="text-red-300">{error}</p>
              {errorModel && (
                <p className="text-red-200/80 text-sm mt-2">
                  Model used: <span className="font-mono">{errorModel}</span>
                </p>
              )}
              {error.includes("overloaded") || error.includes("503") ? (
                <p className="text-red-200/80 text-sm mt-3">
                  The model is currently busy. You can try a different model or wait a moment and try again.
                </p>
              ) : null}
              
              {/* Model Selection */}
              {errorModels.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="error-model" className="block text-sm font-medium mb-2 text-red-200">
                    Select Model to Retry
                  </label>
                  <select
                    id="error-model"
                    value={errorModel || model}
                    onChange={(e) => {
                      setErrorModel(e.target.value);
                      setModel(e.target.value);
                      localStorage.setItem("lazy-writer-finalize-model", e.target.value);
                    }}
                    disabled={isLoadingErrorModels}
                    className="w-full p-2 bg-black border border-red-500/50 text-white rounded focus:outline-none focus:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {errorModels.map((m) => {
                      const isRecommended = m.name === "gemini-flash-latest" || m.name === "gemini-pro-latest";
                      return (
                        <option key={m.name} value={m.name}>
                          {isRecommended ? "⭐ " : ""}{m.displayName} {isRecommended ? "(Recommended)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              
              <button
                onClick={() => {
                  const modelToUse = errorModel || model;
                  setError("");
                  generateEssay(undefined, modelToUse);
                }}
                disabled={isLoadingErrorModels}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Essay Display */}
          <div className="mb-8">
            <div className="p-6 bg-black border border-white rounded">
              <div className="prose prose-invert max-w-none">
                <p className="text-white whitespace-pre-wrap leading-relaxed">{essay}</p>
              </div>
            </div>
          </div>

          {/* Refinement Input */}
          <div className="mb-6">
            <label htmlFor="refinement" className="block text-sm font-medium mb-2 text-white">
              Refinement (optional)
            </label>
            <textarea
              id="refinement"
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder="Enter your refinement instructions here (e.g., 'Make it more formal', 'Add more emotion', 'Shorten it')..."
              className="w-full h-32 p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f]"
              disabled={isRefining}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleCopy}
              disabled={!essay || isRefining}
              className="flex-1 py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copySuccess ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleRefine}
              disabled={!refinement.trim() || isRefining}
              className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRefining ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Refining...</span>
                </>
              ) : (
                "Refine"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

