"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import MCQ from "../components/MCQ";

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

export default function QuestionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contextId = params.contextId as string;

  const [context, setContext] = useState("");
  const [currentMCQ, setCurrentMCQ] = useState<{ question: string; options: string[]; correctIndices?: number[] } | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [freeText, setFreeText] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [questionError, setQuestionError] = useState("");
  const [errorModel, setErrorModel] = useState<string | null>(null);
  const [errorModels, setErrorModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingErrorModels, setIsLoadingErrorModels] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [quizPrompt, setQuizPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [mode, setMode] = useState<"writer" | "quiz">("writer");
  const [currentQuestionHasFeedback, setCurrentQuestionHasFeedback] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeModel, setFinalizeModel] = useState("gemini-flash-latest");
  const [finalizeModels, setFinalizeModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingFinalizeModels, setIsLoadingFinalizeModels] = useState(false);
  const hasCheckedContext = useRef(false);

  useEffect(() => {
    // Load mode from URL params or localStorage
    const urlMode = searchParams.get("mode");
    const savedMode = localStorage.getItem("lazy-writer-mode");
    const modeToUse = (urlMode === "quiz" || urlMode === "writer") ? urlMode : (savedMode === "quiz" || savedMode === "writer" ? savedMode : "writer");
    setMode(modeToUse as "writer" | "quiz");

    // Load context from localStorage
    const savedContext = localStorage.getItem(`lazy-writer-context-${contextId}`) || 
                        localStorage.getItem("lazy-writer-context");
    if (savedContext) {
      setContext(savedContext);
      // Clear any "Context not found" error immediately when context is loaded
      setQuestionError((prevError) => {
        if (prevError && prevError.includes("Context not found")) {
          return "";
        }
        return prevError;
      });
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

    // Load question prompt
    const savedQuestionPrompt = localStorage.getItem("lazy-writer-question-prompt");
    if (savedQuestionPrompt) {
      setQuestionPrompt(savedQuestionPrompt);
    } else {
      fetch("/api/question-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setQuestionPrompt(data.prompt);
            localStorage.setItem("lazy-writer-question-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading question prompt:", error);
        });
    }

    // Load quiz prompt
    const savedQuizPrompt = localStorage.getItem("lazy-writer-quiz-prompt");
    if (savedQuizPrompt) {
      setQuizPrompt(savedQuizPrompt);
    } else {
      fetch("/api/quiz-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setQuizPrompt(data.prompt);
            localStorage.setItem("lazy-writer-quiz-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading quiz prompt:", error);
        });
    }
  }, [contextId, searchParams]);

  useEffect(() => {
    // Generate first question when context and API key are loaded
    // Add a small delay to allow context to load from localStorage first
    let generateTimer: NodeJS.Timeout | null = null;
    
    const checkTimer = setTimeout(() => {
      // Mark that we've checked at least once
      hasCheckedContext.current = true;
      
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

      // Clear any previous errors if context and API key are now available
      setQuestionError((prevError) => {
        if (prevError && (prevError.includes("Context not found") || prevError.includes("API key not found"))) {
          return "";
        }
        return prevError;
      });

      // Wait for prompts to load before generating question
      generateTimer = setTimeout(() => {
        generateQuestion(context, []);
      }, 1000);
    }, 150); // Small delay to allow localStorage to be read
    
    return () => {
      clearTimeout(checkTimer);
      if (generateTimer) {
        clearTimeout(generateTimer);
      }
    };
  }, [context, apiKey, mode, questionPrompt, quizPrompt]);

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
    setCurrentQuestionHasFeedback(false);

    const selectedModel = modelToUse || model;
    const requestBody = {
      context: currentContext,
      conversationHistory: history,
      questionPrompt: mode === "writer" ? (questionPrompt || undefined) : undefined,
      quizPrompt: mode === "quiz" ? (quizPrompt || undefined) : undefined,
      apiKey: apiKey,
      model: selectedModel,
      mode: mode,
    };

    // Log the request being sent
    console.log("=== Client Request to Generate Question ===");
    console.log("Context:", currentContext);
    console.log("Context type:", typeof currentContext);
    console.log("Context length:", currentContext?.length);
    console.log("Conversation history:", history);
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
      let accumulatedText = "";

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
        accumulatedText += chunk;

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
                // Streaming complete - try to extract correctIndices for quiz mode
                let correctIndices: number[] = [];
                if (mode === "quiz") {
                  // Try to parse JSON from accumulated text to extract correctIndices
                  let jsonText = accumulatedText.trim();
                  if (jsonText.startsWith("```")) {
                    const jsonLines = jsonText.split("\n");
                    jsonLines.shift();
                    jsonLines.pop();
                    jsonText = jsonLines.join("\n").trim();
                  }
                  try {
                    const parsed = JSON.parse(jsonText);
                    if (parsed.correctIndices && Array.isArray(parsed.correctIndices)) {
                      correctIndices = parsed.correctIndices;
                    }
                  } catch (e) {
                    // Try regex extraction
                    const correctMatch = jsonText.match(/"correctIndices"\s*:\s*\[([\s\S]*?)\]/);
                    if (correctMatch) {
                      const indicesStr = correctMatch[1];
                      const indices = indicesStr.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
                      correctIndices = indices;
                    }
                  }
                }
                
                // Streaming complete - ensure we have valid MCQ
                console.log(`[Client] Done signal received. Current state:`, {
                  hasQuestion: !!currentQuestion,
                  questionLength: currentQuestion.length,
                  hasOptions: currentOptions.length > 0,
                  optionsCount: currentOptions.length,
                  correctIndices: correctIndices,
                });
                if (currentQuestion && currentOptions.length > 0) {
                  console.log(`[Client] MCQ is complete, setting final state`);
                  setCurrentMCQ({
                    question: currentQuestion,
                    options: currentOptions,
                    correctIndices: correctIndices.length > 0 ? correctIndices : undefined,
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

      // If we get here without a done signal, try to extract correctIndices and use what we have
      let correctIndices: number[] = [];
      if (mode === "quiz" && accumulatedText) {
        let jsonText = accumulatedText.trim();
        if (jsonText.startsWith("```")) {
          const jsonLines = jsonText.split("\n");
          jsonLines.shift();
          jsonLines.pop();
          jsonText = jsonLines.join("\n").trim();
        }
        try {
          const parsed = JSON.parse(jsonText);
          if (parsed.correctIndices && Array.isArray(parsed.correctIndices)) {
            correctIndices = parsed.correctIndices;
          }
        } catch (e) {
          const correctMatch = jsonText.match(/"correctIndices"\s*:\s*\[([\s\S]*?)\]/);
          if (correctMatch) {
            const indicesStr = correctMatch[1];
            const indices = indicesStr.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
            correctIndices = indices;
          }
        }
      }
      
      console.log(`[Client] Stream ended without done signal. Current state:`, {
        hasQuestion: !!currentQuestion,
        questionLength: currentQuestion.length,
        hasOptions: currentOptions.length > 0,
        optionsCount: currentOptions.length,
        correctIndices: correctIndices,
      });
      if (currentQuestion && currentOptions.length > 0) {
        console.log(`[Client] Using available data to set MCQ`);
        setCurrentMCQ({
          question: currentQuestion,
          options: currentOptions,
          correctIndices: correctIndices.length > 0 ? correctIndices : undefined,
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
    
    // In quiz mode, navigate to quiz finalize page, otherwise regular finalize
    if (mode === "quiz") {
      router.push(`/${contextId}/quiz-final`);
    } else {
      router.push(`/${contextId}/final`);
    }
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
    
    // In quiz mode, if we already have feedback, this means "Question Me" was clicked
    if (mode === "quiz" && currentQuestionHasFeedback) {
      // Generate next question
      await generateQuestion(context, conversationHistory);
      return;
    }
    
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

    // For quiz mode, immediately show feedback view with loading state
    if (mode === "quiz" && currentMCQ.correctIndices) {
      // Immediately add to conversation history (without feedback yet) to show feedback view
      const newHistoryItem: ConversationItem = {
        question: currentMCQ.question,
        answer: answer,
        options: currentMCQ.options,
        selectedIndices: selectedOptions,
        freeText: freeText.trim(),
        correctIndices: currentMCQ.correctIndices,
        isQuiz: true,
        hasFeedback: false, // Will be updated when feedback loads
      };
      const updatedHistory = [...conversationHistory, newHistoryItem];
      setConversationHistory(updatedHistory);
      
      // Save conversation history to localStorage
      localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));
      
      // Immediately show feedback view (in loading state)
      setCurrentQuestionHasFeedback(true);
      setIsLoadingFeedback(true);
      
      // Fetch feedback asynchronously
      (async () => {
        try {
          const feedbackResponse = await fetch("/api/quiz-feedback", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: currentMCQ.question,
              options: currentMCQ.options,
              selectedIndices: selectedOptions,
              correctIndices: currentMCQ.correctIndices,
              context: context,
              apiKey: apiKey,
              model: model,
            }),
          });

          if (!feedbackResponse.ok) {
            const errorData = await feedbackResponse.json().catch(() => ({}));
            console.error("Error getting feedback:", errorData);
            setIsLoadingFeedback(false);
            return;
          }
          
          const feedbackData = await feedbackResponse.json();
          
          // Update the last item in conversation history with feedback
          setConversationHistory((prevHistory) => {
            const updatedItem: ConversationItem = {
              ...newHistoryItem,
              feedback: feedbackData.feedback,
              optionFeedback: feedbackData.optionFeedback,
              correctIndices: feedbackData.correctIndices || currentMCQ.correctIndices,
              hasFeedback: true,
            };
            
            const finalHistory = [...prevHistory.slice(0, -1), updatedItem];
            
            // Save updated conversation history to localStorage
            localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(finalHistory));
            
            return finalHistory;
          });
          
          setIsLoadingFeedback(false);
        } catch (error) {
          console.error("Error getting feedback:", error);
          setIsLoadingFeedback(false);
        }
      })();
      
      return;
    }

    // Add to conversation history (writer mode or quiz mode without feedback)
    const newHistoryItem: ConversationItem = {
      question: currentMCQ.question,
      answer: answer,
      options: currentMCQ.options,
      selectedIndices: selectedOptions,
      freeText: freeText.trim(),
      isQuiz: mode === "quiz",
    };
    const updatedHistory = [...conversationHistory, newHistoryItem];
    setConversationHistory(updatedHistory);
    
    // Save conversation history to localStorage
    localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));

    // Generate next question
    await generateQuestion(context, updatedHistory);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className={`${conversationHistory.length > 0 ? "flex flex-col lg:flex-row gap-6 items-start" : ""}`}>
        {/* Left Side: Main Content */}
        <div className={`${conversationHistory.length > 0 ? "flex-1 w-full lg:w-auto" : "w-full"}`}>
          {/* Total Score - Always visible in quiz mode */}
          {mode === "quiz" && (() => {
            let totalQuestionScores = 0;
            let totalCorrectOptions = 0;
            
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
              }
            });
            
            const totalFinalScore = totalQuestionScores;
            const totalScoreDisplay = totalCorrectOptions > 0 ? `${totalFinalScore.toFixed(2)} / ${totalCorrectOptions}` : "0 / 0";
            
            return (
              <div className="mb-4 p-3 bg-black/50 border border-white/30 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-white font-semibold text-base sm:text-lg">Total Score:</span>
                    <span className="text-white font-bold text-lg sm:text-xl ml-2">{totalScoreDisplay}</span>
                  </div>
                  {totalCorrectOptions > 0 && (
                    <div className="text-xs sm:text-sm text-white/70">
                      Sum of question scores: {totalFinalScore.toFixed(2)} / {totalCorrectOptions}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Loading Spinner - Between total score and question content */}
          {isLoadingQuestion && (
            <div className="flex items-center justify-center py-8 mb-4">
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
          )}
          
          {/* Show additional thoughts from last item even when loading new question */}
          {mode === "quiz" && isLoadingQuestion && conversationHistory.length > 0 && (() => {
            const lastItem = conversationHistory[conversationHistory.length - 1];
            if (!lastItem.freeText || !lastItem.freeText.trim()) return null;
            
            return (
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium mb-2 text-white">
                  Your Additional Thoughts (from previous question)
                </label>
                <div className="w-full min-h-[80px] p-2.5 sm:p-3 bg-black/50 border border-white/30 text-white rounded text-sm sm:text-base whitespace-pre-wrap">
                  {lastItem.freeText}
                </div>
              </div>
            );
          })()}
          
      {questionError ? (
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
              <h3 className="text-red-400 font-semibold mb-2 text-sm sm:text-base">Error Generating Question</h3>
              <p className="text-red-300 text-sm sm:text-base">{questionError}</p>
              {errorModel && (
                <p className="text-red-200/80 text-xs sm:text-sm mt-2">
                  Model used: <span className="font-mono">{errorModel}</span>
                </p>
              )}
              {questionError.includes("overloaded") || questionError.includes("503") ? (
                <p className="text-red-200/80 text-xs sm:text-sm mt-3">
                  The model is currently busy. You can try a different model or wait a moment and try again.
                </p>
              ) : null}
              
              {/* Model Selection */}
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
                  setQuestionError("");
                  generateQuestion(context, conversationHistory, modelToUse);
                }}
                disabled={isLoadingErrorModels}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : currentMCQ ? (
        <>
          {/* Show feedback view if available in quiz mode, otherwise show MCQ */}
          {mode === "quiz" && currentQuestionHasFeedback && conversationHistory.length > 0 && (() => {
            const lastItem = conversationHistory[conversationHistory.length - 1];
            const isLoading = isLoadingFeedback || !lastItem.hasFeedback;
            
            // Calculate current question score with Partial Credit with Deduction method
            const correctIndices = lastItem.correctIndices || currentMCQ.correctIndices || [];
            const selectedIndices = lastItem.selectedIndices || [];
            const correctlySelected = selectedIndices.filter(idx => correctIndices.includes(idx)).length;
            const wronglySelected = selectedIndices.filter(idx => !correctIndices.includes(idx)).length;
            const totalCorrect = correctIndices.length;
            const totalOptions = currentMCQ.options.length;
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
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-4 sm:mb-6">
                  {currentMCQ.question}
                </h2>
                
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
                
                {/* Loading State */}
                {isLoading && (
                  <div className="mb-4 p-4 bg-black/50 border border-white/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg
                        className="animate-spin h-5 w-5 text-white"
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
                      <span className="text-white/90 text-sm sm:text-base">Loading feedback...</span>
                    </div>
                  </div>
                )}
                
                {/* Overall Feedback */}
                {!isLoading && lastItem.feedback && (
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
                        {lastItem.feedback}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                
                {/* Options with Feedback */}
                <div className="space-y-2 sm:space-y-3">
                  {currentMCQ.options.map((option, index) => {
                    const optionFeedback = lastItem.optionFeedback?.find((f: any) => f.index === index);
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
                            {!isLoading && optionFeedback?.explanation && (
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
                
                {/* Additional Thoughts Section - Always visible and editable */}
                <div className="mt-4 sm:mt-6">
                  <label htmlFor="feedback-free-text" className="block text-xs sm:text-sm font-medium mb-2 text-white">
                    Additional thoughts (optional)
                  </label>
                  <textarea
                    id="feedback-free-text"
                    value={lastItem.freeText || ""}
                    onChange={(e) => {
                      // Update the last item in conversation history with new freeText
                      setConversationHistory((prevHistory) => {
                        if (prevHistory.length === 0) return prevHistory;
                        const updatedHistory = [...prevHistory];
                        const lastIndex = updatedHistory.length - 1;
                        updatedHistory[lastIndex] = {
                          ...updatedHistory[lastIndex],
                          freeText: e.target.value,
                        };
                        // Save to localStorage
                        localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));
                        return updatedHistory;
                      });
                    }}
                    placeholder="Add any additional context or thoughts here..."
                    className="w-full h-28 sm:h-32 p-2.5 sm:p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm sm:text-base"
                  />
                  {/* Ask about thoughts button - only show when feedback is loaded and freeText is not empty */}
                  {!isLoading && lastItem.freeText && lastItem.freeText.trim() && (
                    <button
                      onClick={async () => {
                        // Generate a follow-up question about the thoughts
                        const thoughtsContext = `${context}\n\nUser's additional thoughts on the last question: ${lastItem.freeText}`;
                        await generateQuestion(thoughtsContext, conversationHistory);
                      }}
                      className="mt-3 w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded transition-colors min-h-[44px] text-sm sm:text-base"
                    >
                      Ask about thoughts
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Show MCQ only if no feedback view in quiz mode, or always in writer mode */}
          {!(mode === "quiz" && currentQuestionHasFeedback && conversationHistory.length > 0) && (
            <MCQ
              question={currentMCQ.question}
              options={currentMCQ.options}
              selectedOptions={selectedOptions}
              freeText={freeText}
              onSelect={handleOptionToggle}
              onFreeTextChange={setFreeText}
            />
          )}
          
          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6 lg:mt-8">
            <button
              onClick={async () => {
                if (!currentMCQ) return;
                
                // In quiz mode with feedback, this is "Question Me"
                if (mode === "quiz" && currentQuestionHasFeedback) {
                  await handleSubmit();
                  return;
                }
                
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
                    isQuiz: mode === "quiz",
                  };
                  const updatedHistory = [...conversationHistory, newHistoryItem];
                  setConversationHistory(updatedHistory);
                  
                  // Save conversation history to localStorage
                  localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(updatedHistory));
                  
                  // Generate next question
                  await generateQuestion(context, updatedHistory);
                }
              }}
              disabled={isLoadingFeedback}
              className="flex-1 py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm lg:text-base"
            >
              {isLoadingFeedback ? (
                <>
                  <svg className="animate-spin h-5 w-5 inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : mode === "quiz" ? (
                currentQuestionHasFeedback ? "Question Me" : "Submit"
              ) : (
                "Question Me"
              )}
            </button>
            <button
              onClick={handleFinalizeClick}
              className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90 min-h-[44px] text-sm lg:text-base"
            >
              Finalize
            </button>
          </div>
        </>
      ) : null}
        </div>

        {/* Right Side: Previous Questions */}
        {conversationHistory.length > 0 && (
          <div className="w-full lg:w-80 shrink-0 mt-6 lg:mt-0">
            <h2 className="text-lg lg:text-xl font-semibold text-white mb-4">Previous Questions</h2>
            <div className="space-y-4 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
              {conversationHistory.map((item, idx) => (
                <div key={idx} className="border-l-2 border-white/30 pl-4 space-y-2">
                  <p className="text-white font-medium text-sm">Q: {item.question}</p>
                  <p className="text-[#fbbc4f] text-sm">A: {item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFinalizeModal(false)}
        >
          <div 
            className="bg-black border-2 border-white rounded-lg max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Finalize Your Writing</h2>
            
            <p className="text-white/90 text-sm sm:text-base">
              We will proceed to finalize your writing, incorporating all your choices and additional messages. Proceed?
            </p>

            {/* Model Selection */}
            <div>
              <label htmlFor="finalize-model" className="block text-base sm:text-lg font-medium mb-2 text-white">
                Model for Finalization
              </label>
              <select
                id="finalize-model"
                value={finalizeModel}
                onChange={(e) => setFinalizeModel(e.target.value)}
                disabled={isLoadingFinalizeModels || finalizeModels.length === 0}
                className="w-full p-2.5 sm:p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f] disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px]"
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-3 px-6 bg-white/20 text-white font-medium rounded transition-opacity hover:opacity-90 min-h-[44px] text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeConfirm}
                disabled={isLoadingFinalizeModels || finalizeModels.length === 0}
                className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
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

