"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [refinement, setRefinement] = useState("");
  const [quizFinalizePrompt, setQuizFinalizePrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState("");
  const [errorModel, setErrorModel] = useState<string | null>(null);
  const [errorModels, setErrorModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingErrorModels, setIsLoadingErrorModels] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

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

    // Load quiz finalize prompt
    const savedQuizFinalizePrompt = localStorage.getItem("lazy-writer-quiz-finalize-prompt");
    if (savedQuizFinalizePrompt) {
      setQuizFinalizePrompt(savedQuizFinalizePrompt);
    } else {
      // Load default from API
      fetch("/api/quiz-finalize-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setQuizFinalizePrompt(data.prompt);
            localStorage.setItem("lazy-writer-quiz-finalize-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading default quiz finalize prompt:", error);
        });
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

  const generateAnalysis = async (refinementText?: string, modelToUse?: string) => {
    if (!apiKey) {
      setError("API key is required");
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
    const requestBody = {
      context: context,
      conversationHistory: conversationHistory,
      refinement: refinementText || undefined,
      quizFinalizePrompt: quizFinalizePrompt || undefined,
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
        setAnalysis("");
        setIsLoading(false);
        setIsRefining(false);
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
        setAnalysis("");
        setIsLoading(false);
        setIsRefining(false);
        return;
      }

      // Clear analysis for new generation
      if (refinementText) {
        setAnalysis("");
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
                currentAnalysis += data.text;
                setAnalysis(currentAnalysis);
              } else if (data.type === "done") {
                // Streaming complete
                if (refinementText) {
                  setRefinement("");
                }
                setIsLoading(false);
                setIsRefining(false);
                return;
              } else if (data.type === "error") {
                setError(data.error || "An error occurred");
                setErrorModel(data.model || model);
                setAnalysis("");
                setIsLoading(false);
                setIsRefining(false);
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

      // If we get here, streaming completed
      if (refinementText) {
        setRefinement("");
      }
    } catch (error) {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate analysis. Please try again.";
      setError(errorMessage);
      setAnalysis("");
    } finally {
      setIsLoading(false);
      setIsRefining(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(analysis);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      setError("Failed to copy to clipboard");
    }
  };

  const handleRefine = () => {
    if (refinement.trim()) {
      generateAnalysis(refinement.trim(), model);
    }
  };

  // Calculate total score from conversation history using Partial Credit with Deduction method
  const calculateTotalScore = () => {
    let totalQuestionScores = 0;
    let totalCorrectOptions = 0;
    let totalCorrectlySelected = 0;
    let totalWronglySelected = 0;
    
    conversationHistory.forEach((item: ConversationItem) => {
      if (item.isQuiz && item.hasFeedback && item.correctIndices && item.options) {
        const correctIndices = item.correctIndices;
        const selectedIndices = item.selectedIndices || [];
        const correctlySelected = selectedIndices.filter(idx => correctIndices.includes(idx)).length;
        const wronglySelected = selectedIndices.filter(idx => !correctIndices.includes(idx)).length;
        const totalCorrect = correctIndices.length;
        const totalOptions = item.options.length;
        const totalIncorrect = totalOptions - totalCorrect;
        
        // Partial Credit with Deduction method for each question
        const pointsPerCorrect = 1; // Normalized: totalCorrect / totalCorrect = 1
        const penaltyPerIncorrect = totalIncorrect > 0 ? -(totalCorrect / totalIncorrect) : 0;
        const questionScore = (correctlySelected * pointsPerCorrect) + (wronglySelected * penaltyPerIncorrect);
        const finalQuestionScore = Math.max(0, questionScore);
        
        totalQuestionScores += finalQuestionScore;
        totalCorrectOptions += totalCorrect;
        totalCorrectlySelected += correctlySelected;
        totalWronglySelected += wronglySelected;
      }
    });
    
    const totalFinalScore = totalQuestionScores;
    const totalScoreDisplay = totalCorrectOptions > 0 ? `${totalFinalScore.toFixed(2)} / ${totalCorrectOptions}` : "0 / 0";
    
    return {
      totalCorrectlySelected,
      totalWronglySelected,
      totalCorrectOptions,
      totalFinalScore,
      totalScoreDisplay,
    };
  };

  // Filter quiz questions with feedback
  const quizQuestions = conversationHistory.filter(
    (item: ConversationItem) => item.isQuiz && item.hasFeedback
  );

  // Reset selected question index if out of bounds
  useEffect(() => {
    if (selectedQuestionIndex >= quizQuestions.length && quizQuestions.length > 0) {
      setSelectedQuestionIndex(0);
    }
  }, [quizQuestions.length, selectedQuestionIndex]);

  const totalScore = calculateTotalScore();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Total Score Display - At the top */}
      {quizQuestions.length > 0 && (
        <div className="mb-6 p-3 bg-black/50 border border-white/30 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-white font-semibold text-base sm:text-lg">Total Score:</span>
              <span className="text-white font-bold text-lg sm:text-xl ml-2">{totalScore.totalScoreDisplay}</span>
            </div>
            {totalScore.totalCorrectOptions > 0 && (
              <div className="text-xs sm:text-sm text-white/70">
                Sum of question scores: {totalScore.totalFinalScore.toFixed(2)} / {totalScore.totalCorrectOptions}
              </div>
            )}
          </div>
        </div>
      )}

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
        <>
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Your Performance Analysis</h2>
            <div className="bg-black/50 border border-white/30 rounded-lg p-4 sm:p-6">
              <div className="prose prose-invert max-w-none text-white text-sm sm:text-base">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-5 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h4>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1.5 ml-4">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1.5 ml-4">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-black/70 px-1.5 py-0.5 rounded text-[#fbbc4f] text-xs">{children}</code>
                      ) : (
                        <code className="block bg-black/70 p-3 rounded mb-3 text-[#fbbc4f] text-xs overflow-x-auto">{children}</code>
                      );
                    },
                    pre: ({ children }) => <pre className="bg-black/70 p-3 rounded mb-3 overflow-x-auto">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-white/30 pl-4 italic my-3">{children}</blockquote>,
                    a: ({ href, children }) => <a href={href} className="text-[#fbbc4f] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    hr: () => <hr className="my-4 border-white/30" />,
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border-collapse border border-white/30">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-black/70">{children}</thead>,
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr className="border-b border-white/30">{children}</tr>,
                    th: ({ children }) => (
                      <th className="border border-white/30 px-3 py-2 text-left font-semibold bg-black/50">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-white/30 px-3 py-2">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {analysis}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Refinement Input */}
          <div className="mb-6 mt-8">
            <label htmlFor="refinement" className="block text-sm font-medium mb-2 text-white">
              Refinement (optional)
            </label>
            <textarea
              id="refinement"
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder="Enter your refinement instructions here (e.g., 'Focus more on strengths', 'Add more specific recommendations', 'Make it shorter')..."
              className="w-full h-32 p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f]"
              disabled={isRefining}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={handleCopy}
              disabled={!analysis || isRefining}
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

          {/* Question Tabs Section */}
          {quizQuestions.length > 0 && (
            <div className="mt-8 mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">Previous Questions</h2>
              
              {/* Tab Headers */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {quizQuestions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedQuestionIndex(index)}
                    className={`px-4 py-2 rounded transition-colors min-w-[60px] text-sm sm:text-base font-medium ${
                      selectedQuestionIndex === index
                        ? "bg-[#fbbc4f] text-black"
                        : "bg-black/50 border border-white/30 text-white hover:bg-black/70"
                    }`}
                  >
                    Q{index + 1}
                  </button>
                ))}
              </div>

              {/* Selected Question Content */}
              {quizQuestions[selectedQuestionIndex] && (() => {
                const item = quizQuestions[selectedQuestionIndex];
                const correctIndices = item.correctIndices || [];
                const selectedIndices = item.selectedIndices || [];
                const correctlySelected = selectedIndices.filter(idx => correctIndices.includes(idx)).length;
                const wronglySelected = selectedIndices.filter(idx => !correctIndices.includes(idx)).length;
                const totalCorrect = correctIndices.length;
                const totalOptions = item.options?.length || 0;
                const totalIncorrect = totalOptions - totalCorrect;
                
                // Partial Credit with Deduction method:
                // Points per correct = Total points / Number of correct options
                // Penalty per incorrect = - (Total points) / Number of incorrect options
                // Using totalCorrect as "Total points" for normalization
                const pointsPerCorrect = 1; // Normalized: totalCorrect / totalCorrect = 1
                const penaltyPerIncorrect = totalIncorrect > 0 ? -(totalCorrect / totalIncorrect) : 0;
                
                // Question Score = (correctlySelected * pointsPerCorrect) + (wronglySelected * penaltyPerIncorrect)
                const questionScore = (correctlySelected * pointsPerCorrect) + (wronglySelected * penaltyPerIncorrect);
                const finalScore = Math.max(0, questionScore);
                const scoreDisplay = totalCorrect > 0 ? `${finalScore.toFixed(2)} / ${totalCorrect}` : "0 / 0";
                const calculation = totalIncorrect > 0 
                  ? `(${correctlySelected} correct × ${pointsPerCorrect} point + ${wronglySelected} wrong × ${penaltyPerIncorrect.toFixed(2)} penalty) = ${questionScore.toFixed(2)} raw → ${finalScore.toFixed(2)} / ${totalCorrect} total correct`
                  : `(${correctlySelected} correct × ${pointsPerCorrect} point) = ${finalScore.toFixed(2)} / ${totalCorrect} total correct`;

                return (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Question */}
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-4 sm:mb-6">
                      {item.question}
                    </h3>
                    
                    {/* Current Question Score Display */}
                    <div className="mb-4 p-3 bg-black/50 border border-white/30 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-white font-semibold text-base sm:text-lg">This Question:</span>
                          <span className="text-white font-bold text-lg sm:text-xl ml-2">{scoreDisplay}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-white/70">
                          {calculation}
                        </div>
                      </div>
                    </div>
                    
                    {/* Overall Feedback */}
                    {item.feedback && (
                      <div className="mb-4 p-3 bg-black/50 border border-white/30 rounded-lg">
                        <div className="prose prose-invert max-w-none text-white/90 text-sm sm:text-base">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="ml-2">{children}</li>,
                              code: ({ children, className }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="bg-black/70 px-1 py-0.5 rounded text-[#fbbc4f] text-xs">{children}</code>
                                ) : (
                                  <code className="block bg-black/70 p-2 rounded text-[#fbbc4f] text-xs overflow-x-auto">{children}</code>
                                );
                              },
                              pre: ({ children }) => <pre className="bg-black/70 p-2 rounded mb-2 overflow-x-auto">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-white/30 pl-4 italic my-2">{children}</blockquote>,
                              a: ({ href, children }) => <a href={href} className="text-[#fbbc4f] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                            }}
                          >
                            {item.feedback}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {/* Options with Feedback */}
                    {item.options && item.options.length > 0 && (
                      <div className="space-y-2 sm:space-y-3">
                        {item.options.map((option, index) => {
                          const optionFeedback = item.optionFeedback?.find((f: any) => f.index === index);
                          const isCorrect = correctIndices.includes(index);
                          const wasSelected = selectedIndices.includes(index);
                          
                          // Determine visual state
                          let borderColor = "border-white/30";
                          let bgColor = "bg-black/30";
                          let textColor = "text-white";
                          
                          if (wasSelected && isCorrect) {
                            // Selected + Correct
                            borderColor = "border-green-500";
                            bgColor = "bg-green-950/30";
                          } else if (wasSelected && !isCorrect) {
                            // Selected + Wrong
                            borderColor = "border-red-500";
                            bgColor = "bg-red-950/30";
                          } else if (!wasSelected && isCorrect) {
                            // Not Selected + Correct
                            borderColor = "border-green-500/50";
                            bgColor = "bg-green-950/20";
                          } else {
                            // Not Selected + Wrong
                            borderColor = "border-white/20";
                            bgColor = "bg-black/20";
                            textColor = "text-white/70";
                          }
                          
                          return (
                            <div
                              key={index}
                              className={`p-3 sm:p-4 rounded border-2 ${borderColor} ${bgColor}`}
                            >
                              <div className="flex items-start gap-2 sm:gap-3">
                                {/* Checkbox/Status Indicator */}
                                <div
                                  className={`shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center mt-0.5 ${
                                    isCorrect
                                      ? "border-green-500 bg-green-500"
                                      : "border-red-500 bg-red-500"
                                  }`}
                                >
                                  <span className="text-white text-xs sm:text-sm font-bold">
                                    {isCorrect ? "✓" : "✗"}
                                  </span>
                                </div>
                                
                                {/* Option Content */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm sm:text-base ${textColor}`}>{option}</span>
                                    {wasSelected && (
                                      <span className="px-2 py-0.5 bg-[#fbbc4f] text-black text-xs font-semibold rounded">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  {optionFeedback?.explanation && (
                                    <div className="text-white/70 text-xs sm:text-sm mt-2 prose prose-invert max-w-none">
                                      <ReactMarkdown
                                        components={{
                                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                          h1: ({ children }) => <h1 className="text-base font-bold mb-1 mt-2 first:mt-0">{children}</h1>,
                                          h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h2>,
                                          h3: ({ children }) => <h3 className="text-xs font-bold mb-1 mt-1 first:mt-0">{children}</h3>,
                                          ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                                          ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                                          li: ({ children }) => <li className="ml-1">{children}</li>,
                                          code: ({ children, className }) => {
                                            const isInline = !className;
                                            return isInline ? (
                                              <code className="bg-black/70 px-1 py-0.5 rounded text-[#fbbc4f] text-xs">{children}</code>
                                            ) : (
                                              <code className="block bg-black/70 p-1 rounded text-[#fbbc4f] text-xs overflow-x-auto">{children}</code>
                                            );
                                          },
                                          pre: ({ children }) => <pre className="bg-black/70 p-1 rounded mb-1 overflow-x-auto">{children}</pre>,
                                          blockquote: ({ children }) => <blockquote className="border-l-2 border-white/30 pl-2 italic my-1">{children}</blockquote>,
                                          a: ({ href, children }) => <a href={href} className="text-[#fbbc4f] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                          em: ({ children }) => <em className="italic">{children}</em>,
                                        }}
                                      >
                                        {optionFeedback.explanation}
                                      </ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
