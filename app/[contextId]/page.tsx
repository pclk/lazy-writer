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
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");

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

  const generateQuestion = async (currentContext: string, history: ConversationItem[] = []) => {
    if (!apiKey) {
      setQuestionError("API key is required");
      setIsLoadingQuestion(false);
      return;
    }

    setIsLoadingQuestion(true);
    setQuestionError("");
    setSelectedOptions([]);
    setFreeText("");

    const requestBody = {
      context: currentContext,
      conversationHistory: history,
      systemPrompt: systemPrompt || undefined,
      apiKey: apiKey,
    };

    // Log the request being sent
    console.log("=== Client Request to Generate Question ===");
    console.log("Context:", currentContext);
    console.log("Context type:", typeof currentContext);
    console.log("Context length:", currentContext?.length);
    console.log("Conversation history:", history);
    console.log("System prompt:", systemPrompt);
    console.log("API key present:", !!apiKey);
    console.log("Full request body:", JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      console.log("=== Client Response ===");
      console.log("Response data:", data);

      if (data.error) {
        setQuestionError(data.error);
        setCurrentMCQ(null);
      } else if (data.question && data.options) {
        setCurrentMCQ({ question: data.question, options: data.options });
      } else {
        setQuestionError("Invalid response format");
        setCurrentMCQ(null);
      }
    } catch (error) {
      setQuestionError("Failed to generate question. Please try again.");
      setCurrentMCQ(null);
    } finally {
      setIsLoadingQuestion(false);
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
        <div className="p-4 border border-red-400 rounded">
          <p className="text-red-400">{questionError}</p>
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
              onClick={() => router.push(`/${contextId}/final`)}
              className="flex-1 py-3 px-6 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90"
            >
              Finalize
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

