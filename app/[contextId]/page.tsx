"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import MCQ from "../components/MCQ";

interface ConversationItem {
  question: string;
  answer: string;
  options: string[];
  selectedIndices: number[];
  freeText: string;
}

export default function QuestionPage() {
  const params = useParams();
  const router = useRouter();
  const contextId = params.contextId as string;

  const [context, setContext] = useState("");
  const [currentMCQ, setCurrentMCQ] = useState<{ question: string; options: string[] } | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [freeText, setFreeText] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [questionError, setQuestionError] = useState("");
  const [errorModel, setErrorModel] = useState<string | null>(null);
  const [errorModels, setErrorModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingErrorModels, setIsLoadingErrorModels] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeModel, setFinalizeModel] = useState("gemini-flash-latest");
  const [finalizeModels, setFinalizeModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingFinalizeModels, setIsLoadingFinalizeModels] = useState(false);

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

    // Load model
    const savedModel = localStorage.getItem("lazy-writer-model");
    if (savedModel) {
      setModel(savedModel);
      setFinalizeModel(savedModel);
    }

    // Load system prompt
    const savedPrompt = localStorage.getItem("lazy-writer-system-prompt");
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
    } else {
      // Load default from API
      fetch("/api/system-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setSystemPrompt(data.prompt);
            localStorage.setItem("lazy-writer-system-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading system prompt:", error);
        });
    }
  }, [contextId]);

  useEffect(() => {
    // Generate first question when context and API key are loaded
    if (!context || !apiKey) {
      if (!context) {
        setQuestionError("Context not found. Please go back and enter your context.");
        setIsLoadingQuestion(false);
      } else if (!apiKey) {
        setQuestionError("API key not found. Please go back and save your API key.");
        setIsLoadingQuestion(false);
      }
      return;
    }

    if (systemPrompt) {
      generateQuestion(context, []);
    } else {
      // Wait for system prompt to load (it's being fetched in the first useEffect)
      const timer = setTimeout(() => {
        if (systemPrompt) {
          generateQuestion(context, []);
        } else {
          // If still no system prompt after timeout, try with empty (will use default from API)
          generateQuestion(context, []);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [context, apiKey, systemPrompt]);

  const generateQuestion = async (currentContext: string, history: ConversationItem[] = [], modelToUse?: string) => {
    if (!apiKey) {
      setQuestionError("API key is required");
      setIsLoadingQuestion(false);
      return;
    }

    setIsLoadingQuestion(true);
    setQuestionError("");
    setSelectedOptions([]);
    setFreeText("");
    setCurrentMCQ(null); // Clear previous MCQ

    const selectedModel = modelToUse || model;
    const requestBody = {
      context: currentContext,
      conversationHistory: history,
      systemPrompt: systemPrompt || undefined,
      apiKey: apiKey,
      model: selectedModel,
    };

    // Log the request being sent
    console.log("=== Client Request to Generate Question ===");
    console.log("Context:", currentContext);
    console.log("Context type:", typeof currentContext);
    console.log("Context length:", currentContext?.length);
    console.log("Conversation history:", history);
    console.log("System prompt:", systemPrompt);
    console.log("API key present:", !!apiKey);

    try {
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Check if response is an error (non-OK status)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Extract error message - handle array format from Gemini API
        let errorMessage = "Failed to generate question";
        const errorDetails = errorData.errorDetails;
        if (Array.isArray(errorDetails) && errorDetails.length > 0) {
          errorMessage = errorDetails[0]?.error?.message || errorDetails[0]?.error || errorMessage;
        } else if (errorDetails?.error) {
          errorMessage = errorDetails.error?.message || errorDetails.error || errorMessage;
        } else {
          errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}` || errorMessage;
        }
        
        setQuestionError(errorMessage);
        setErrorModel(errorData.model || model);
        setCurrentMCQ(null);
        setIsLoadingQuestion(false);
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
      let currentQuestion = "";
      let currentOptions: string[] = [];

      if (!reader) {
        setQuestionError("No response stream available");
        setCurrentMCQ(null);
        setIsLoadingQuestion(false);
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
              console.log(`[Client] Received data:`, { type: data.type, hasQuestion: !!data.question, hasOptions: !!data.options, optionsCount: data.options?.length || 0 });
              
              if (data.type === "mcq") {
                // Update question if provided
                if (data.question !== undefined && data.question !== null) {
                  console.log(`[Client] Updating question (${data.question.length} chars): ${data.question.substring(0, 100)}...`);
                  currentQuestion = data.question;
                }
                
                // Update options if provided
                if (data.options !== undefined && Array.isArray(data.options) && data.options.length > 0) {
                  console.log(`[Client] Updating options: ${data.options.length} options received`);
                  data.options.forEach((opt: string, idx: number) => {
                    console.log(`[Client]   Option ${idx + 1}: ${opt.substring(0, 50)}...`);
                  });
                  currentOptions = data.options;
                }

                // Always update MCQ state when we receive MCQ data, and hide loader
                // This ensures the UI updates even with partial data
                console.log(`[Client] Processing MCQ update:`, {
                  receivedQuestion: !!data.question,
                  receivedOptions: !!data.options,
                  currentQuestionLength: currentQuestion?.length || 0,
                  currentOptionsCount: currentOptions.length,
                });
                
                // Always hide loader and update state when we receive any MCQ data
                // This allows the UI to show partial content as it streams
                setIsLoadingQuestion(false);
                
                setCurrentMCQ({
                  question: currentQuestion || "",
                  options: currentOptions.length > 0 ? currentOptions : [],
                });
                
                console.log(`[Client] State updated - loader hidden, MCQ set`);
              } else if (data.type === "done") {
                // Streaming complete - ensure we have valid MCQ
                console.log(`[Client] Done signal received. Current state:`, {
                  hasQuestion: !!currentQuestion,
                  questionLength: currentQuestion.length,
                  hasOptions: currentOptions.length > 0,
                  optionsCount: currentOptions.length,
                });
                if (currentQuestion && currentOptions.length > 0) {
                  console.log(`[Client] MCQ is complete, setting final state`);
                  setCurrentMCQ({
                    question: currentQuestion,
                    options: currentOptions,
                  });
                } else {
                  console.error(`[Client] ERROR: Incomplete MCQ received!`, {
                    question: currentQuestion || "MISSING",
                    options: currentOptions.length > 0 ? `${currentOptions.length} options` : "MISSING",
                  });
                  setQuestionError("Incomplete MCQ received");
                  setCurrentMCQ(null);
                }
                setIsLoadingQuestion(false);
                return;
              } else if (data.type === "error") {
                console.error(`[Client] Error received:`, data.error);
                setQuestionError(data.error || "An error occurred");
                setErrorModel(data.model || model);
                setCurrentMCQ(null);
                setIsLoadingQuestion(false);
                // Load models for error UI
                if (apiKey) {
                  loadErrorModels(apiKey);
                }
                return;
              }
            } catch (e) {
              console.error(`[Client] Error parsing SSE data:`, e, `Line:`, line.substring(0, 100));
              // Skip invalid JSON
            }
          }
        }
      }

      // If we get here without a done signal, use what we have
      console.log(`[Client] Stream ended without done signal. Current state:`, {
        hasQuestion: !!currentQuestion,
        questionLength: currentQuestion.length,
        hasOptions: currentOptions.length > 0,
        optionsCount: currentOptions.length,
      });
      if (currentQuestion && currentOptions.length > 0) {
        console.log(`[Client] Using available data to set MCQ`);
        setCurrentMCQ({
          question: currentQuestion,
          options: currentOptions,
        });
        setIsLoadingQuestion(false);
      } else {
        console.error(`[Client] ERROR: Incomplete response - missing question or options`);
        setQuestionError("Incomplete response received");
        setCurrentMCQ(null);
      }
    } catch (error) {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate question. Please try again.";
      setQuestionError(errorMessage);
      setCurrentMCQ(null);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

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

  const loadFinalizeModels = async (apiKeyToUse: string) => {
    setIsLoadingFinalizeModels(true);
    try {
      const response = await fetch(`/api/list-models?apiKey=${encodeURIComponent(apiKeyToUse)}`);
      const data = await response.json();
      
      if (data.error) {
        console.error("Error loading models:", data.error);
        // Fallback to default models if API call fails
        setFinalizeModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      } else if (data.models && data.models.length > 0) {
        setFinalizeModels(data.models);
        // If current model is not in the list, set to first available model
        const currentModelExists = data.models.some((m: { name: string }) => m.name === finalizeModel);
        if (!currentModelExists && data.models.length > 0) {
          const firstModel = data.models[0].name;
          setFinalizeModel(firstModel);
        }
      } else {
        // Fallback to default models
        setFinalizeModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      // Fallback to default models
      setFinalizeModels([
        { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
        { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
      ]);
    } finally {
      setIsLoadingFinalizeModels(false);
    }
  };

  const handleFinalizeClick = () => {
    if (apiKey) {
      loadFinalizeModels(apiKey);
    } else {
      // Use default models if no API key
      setFinalizeModels([
        { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
        { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
      ]);
    }
    setShowFinalizeModal(true);
  };

  const handleFinalizeConfirm = () => {
    // Save the finalize model to localStorage so the finalize page can use it
    localStorage.setItem("lazy-writer-finalize-model", finalizeModel);
    setShowFinalizeModal(false);
    router.push(`/${contextId}/final`);
  };

  const handleOptionToggle = (index: number) => {
    setSelectedOptions((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleSubmit = async () => {
    if (!currentMCQ) return;
    if (selectedOptions.length === 0 && !freeText.trim()) return;

    // Build answer string from selected options and free text
    const selectedAnswers = selectedOptions
      .map((idx) => currentMCQ.options[idx])
      .join(", ");
    
    let answer = selectedAnswers;
    if (freeText.trim()) {
      answer = selectedAnswers 
        ? `${selectedAnswers} | Additional: ${freeText.trim()}`
        : `Additional: ${freeText.trim()}`;
    }

    // Add to conversation history
    const newHistoryItem: ConversationItem = {
      question: currentMCQ.question,
      answer: answer,
      options: currentMCQ.options,
      selectedIndices: selectedOptions,
      freeText: freeText.trim(),
    };
    const updatedHistory = [...conversationHistory, newHistoryItem];
    setConversationHistory(updatedHistory);
    
    // Save conversation history to localStorage
    localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));

    // Generate next question
    await generateQuestion(context, updatedHistory);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="mb-8 space-y-6">
          <h2 className="text-xl font-semibold text-white mb-4">Previous Questions</h2>
          {conversationHistory.map((item, idx) => (
            <div key={idx} className="border-l-2 border-white/30 pl-4 space-y-2">
              <p className="text-white font-medium">Q: {item.question}</p>
              <p className="text-[#fbbc4f]">A: {item.answer}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading or Current MCQ */}
      {isLoadingQuestion ? (
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
      ) : questionError ? (
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
              <h3 className="text-red-400 font-semibold mb-2">Error Generating Question</h3>
              <p className="text-red-300">{questionError}</p>
              {errorModel && (
                <p className="text-red-200/80 text-sm mt-2">
                  Model used: <span className="font-mono">{errorModel}</span>
                </p>
              )}
              {questionError.includes("overloaded") || questionError.includes("503") ? (
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
                      localStorage.setItem("lazy-writer-model", e.target.value);
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
                  setQuestionError("");
                  generateQuestion(context, conversationHistory, modelToUse);
                }}
                disabled={isLoadingErrorModels}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : currentMCQ ? (
        <>
          <MCQ
            question={currentMCQ.question}
            options={currentMCQ.options}
            selectedOptions={selectedOptions}
            freeText={freeText}
            onSelect={handleOptionToggle}
            onFreeTextChange={setFreeText}
          />
          
          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={async () => {
                if (!currentMCQ) return;
                
                // If there are selections or free text, submit the current answer first
                if (selectedOptions.length > 0 || freeText.trim()) {
                  await handleSubmit();
                } else {
                  // If no selections or free text, mark all options as not selected
                  const newHistoryItem: ConversationItem = {
                    question: currentMCQ.question,
                    answer: "No selection made",
                    options: currentMCQ.options,
                    selectedIndices: [], // Empty array means all options are not selected
                    freeText: "",
                  };
                  const updatedHistory = [...conversationHistory, newHistoryItem];
                  setConversationHistory(updatedHistory);
                  
                  // Save conversation history to localStorage
                  localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));
                  
                  // Generate next question
                  await generateQuestion(context, updatedHistory);
                }
              }}
              className="flex-1 py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90"
            >
              Question Me
            </button>
            <button
              onClick={handleFinalizeClick}
              className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90"
            >
              Finalize
            </button>
          </div>
        </>
      ) : null}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFinalizeModal(false)}
        >
          <div 
            className="bg-black border-2 border-white rounded-lg max-w-lg w-full p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold text-white">Finalize Your Writing</h2>
            
            <p className="text-white/90">
              We will proceed to finalize your writing, incorporating all your choices and additional messages. Proceed?
            </p>

            {/* Model Selection */}
            <div>
              <label htmlFor="finalize-model" className="block text-lg font-medium mb-2 text-white">
                Model for Finalization
              </label>
              <select
                id="finalize-model"
                value={finalizeModel}
                onChange={(e) => setFinalizeModel(e.target.value)}
                disabled={isLoadingFinalizeModels || finalizeModels.length === 0}
                className="w-full p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingFinalizeModels ? (
                  <option>Loading models...</option>
                ) : finalizeModels.length === 0 ? (
                  <option>No models available</option>
                ) : (
                  finalizeModels.map((m) => {
                    const isRecommended = m.name === "gemini-flash-latest" || m.name === "gemini-pro-latest";
                    return (
                      <option key={m.name} value={m.name}>
                        {isRecommended ? "⭐ " : ""}{m.displayName} {isRecommended ? "(Recommended)" : ""} {m.description && !isRecommended ? `- ${m.description}` : ""}
                      </option>
                    );
                  })
                )}
              </select>
              <p className="text-sm text-white/70 mt-2">
                {isLoadingFinalizeModels
                  ? "Loading available models..."
                  : finalizeModels.length === 0
                  ? "No models available."
                  : "Select the Gemini model to use for writing and refining your final essay."}
              </p>
            </div>

            {/* Modal Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-3 px-6 bg-white/20 text-white font-medium rounded transition-opacity hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeConfirm}
                disabled={isLoadingFinalizeModels || finalizeModels.length === 0}
                className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

