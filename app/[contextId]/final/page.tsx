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
  const [essay, setEssay] = useState("");
  const [refinement, setRefinement] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState("");
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

  const generateEssay = async (refinementText?: string) => {
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
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setEssay("");
      } else if (data.essay) {
        setEssay(data.essay);
        if (refinementText) {
          setRefinement("");
        }
      } else {
        setError("Invalid response format");
        setEssay("");
      }
    } catch (error) {
      setError("Failed to generate essay. Please try again.");
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
      generateEssay(refinement.trim());
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
        <div className="p-4 border border-red-400 rounded">
          <p className="text-red-400">{error}</p>
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

