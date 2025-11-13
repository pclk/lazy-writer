"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ConversationItem {
  question: string;
  answer: string;
  options: string[];
  selectedIndices: number[];
  freeText: string;
  feedback?: string;
  optionFeedback?: Array<{ index: number; isCorrect: boolean; explanation: string }>;
  correctIndices?: number[];
  isQuiz?: boolean;
  hasFeedback?: boolean;
}

export default function QuizFinalPage() {
  const params = useParams();
  const contextId = params.contextId as string;

  const [context, setContext] = useState("");
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
    // Generate initial analysis when context and API key are loaded
    if (context && apiKey) {
      generateAnalysis();
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
        setErrorModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      } else if (data.models && data.models.length > 0) {
        setErrorModels(data.models);
        if (!errorModel) {
          setErrorModel(model);
        }
      } else {
        setErrorModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      setErrorModels([
        { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
        { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
      ]);
    } finally {
      setIsLoadingErrorModels(false);
    }
  };

  const generateAnalysis = async (modelToUse?: string) => {
    if (!apiKey) {
      setError("API key is required");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    setAnalysis("");

    const selectedModel = modelToUse || model;
    const requestBody = {
      context: context,
      conversationHistory: conversationHistory,
      apiKey: apiKey,
      model: selectedModel,
    };

    try {
      const response = await fetch("/api/quiz-finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = "Failed to generate analysis";
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
        setIsLoading(false);
        if (apiKey) {
          loadErrorModels(apiKey);
        }
        return;
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentAnalysis = "";

      if (!reader) {
        setError("No response stream available");
        setIsLoading(false);
        return;
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
              
              if (data.type === "chunk") {
                currentAnalysis += data.text;
                setAnalysis(currentAnalysis);
              } else if (data.type === "done") {
                setIsLoading(false);
                return;
              } else if (data.type === "error") {
                setError(data.error || "An error occurred");
                setErrorModel(data.model || model);
                setIsLoading(false);
                if (apiKey) {
                  loadErrorModels(apiKey);
                }
                return;
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate analysis. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">Quiz Performance Analysis</h1>
      
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
        <div className="p-4 sm:p-6 border-2 border-red-500/50 rounded-lg bg-red-950/20">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0 mt-0.5"
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
              <h3 className="text-red-400 font-semibold mb-2 text-sm sm:text-base">Error Generating Analysis</h3>
              <p className="text-red-300 text-sm sm:text-base">{error}</p>
              {errorModel && (
                <p className="text-red-200/80 text-xs sm:text-sm mt-2">
                  Model used: <span className="font-mono">{errorModel}</span>
                </p>
              )}
              
              {errorModels.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="error-model" className="block text-xs sm:text-sm font-medium mb-2 text-red-200">
                    Select Model to Retry
                  </label>
                  <select
                    id="error-model"
                    value={errorModel || model}
                    onChange={(e) => {
                      setErrorModel(e.target.value);
                      setModel(e.target.value);
                      localStorage.setItem("lazy-writer-model", e.target.value);
                    }}
                    disabled={isLoadingErrorModels}
                    className="w-full p-2 bg-black border border-red-500/50 text-white rounded focus:outline-none focus:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px]"
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
                  generateAnalysis(modelToUse);
                }}
                disabled={isLoadingErrorModels}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Your Performance Analysis</h2>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors text-sm sm:text-base min-h-[44px]"
            >
              {copySuccess ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="bg-black/50 border border-white/30 rounded-lg p-4 sm:p-6">
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-white text-sm sm:text-base font-sans">{analysis}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
