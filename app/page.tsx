"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConversationItem {
  question: string;
  answer: string;
  options: string[];
  selectedIndices: number[];
  freeText: string;
}

export default function Home() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [context, setContext] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [models, setModels] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [actualApiKey, setActualApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [greeting, setGreeting] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [mode, setMode] = useState<"writer" | "quiz">("writer");

  const loadModels = async (apiKeyToUse: string) => {
    setIsLoadingModels(true);
    try {
      const response = await fetch(`/api/list-models?apiKey=${encodeURIComponent(apiKeyToUse)}`);
      const data = await response.json();
      
      if (data.error) {
        console.error("Error loading models:", data.error);
        // Fallback to default models if API call fails
        setModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      } else if (data.models && data.models.length > 0) {
        setModels(data.models);
        // If current model is not in the list, set to first available model
        const savedModel = localStorage.getItem("lazy-writer-model") || "gemini-flash-latest";
        const currentModelExists = data.models.some((m: { name: string }) => m.name === savedModel);
        if (!currentModelExists && data.models.length > 0) {
          const firstModel = data.models[0].name;
          setModel(firstModel);
          localStorage.setItem("lazy-writer-model", firstModel);
        }
      } else {
        // Fallback to default models
        setModels([
          { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
          { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
        ]);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      // Fallback to default models
      setModels([
        { name: "gemini-flash-latest", displayName: "Gemini Flash (Latest)", description: "" },
        { name: "gemini-pro-latest", displayName: "Gemini Pro (Latest)", description: "" },
      ]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    // Load saved API key on mount
    const saved = localStorage.getItem("lazy-writer-api-key");
    if (saved) {
      setActualApiKey(saved);
      // Show masked version for display
      const masked = saved.substring(0, 3) + "*".repeat(Math.max(0, saved.length - 6)) + saved.substring(saved.length - 3);
      setApiKey(masked);
      setIsApiKeySaved(true);
    }
    
    // Load saved model if exists
    const savedModel = localStorage.getItem("lazy-writer-model");
    if (savedModel) {
      setModel(savedModel);
    }
    
    // Load saved context if exists
    const savedContext = localStorage.getItem("lazy-writer-context");
    if (savedContext) {
      setContext(savedContext);
    }
    
    // Load saved mode if exists
    const savedMode = localStorage.getItem("lazy-writer-mode");
    if (savedMode === "writer" || savedMode === "quiz") {
      setMode(savedMode);
    }
    
    // Load models if API key is already saved
    if (saved) {
      loadModels(saved);
    }
    
    // Listen for conversation updates to refresh sidebar
    const handleConversationUpdate = () => {
      // Sidebar will handle its own refresh, but we can trigger a re-render if needed
      window.dispatchEvent(new Event("conversation-updated"));
    };
    
    // Listen for new conversation event to clear form
    const handleNewConversation = () => {
      setContext("");
      setConversationHistory([]);
      setActiveContextId(null);
      localStorage.removeItem("lazy-writer-active-context-id");
      // Focus on context textarea after clearing
      setTimeout(() => {
        const contextTextarea = document.getElementById("context");
        if (contextTextarea) {
          contextTextarea.focus();
        }
      }, 100);
    };
    
    // Listen for conversation load events
    const handleLoadConversation = (e: Event) => {
      const customEvent = e as CustomEvent<{ contextId: string }>;
      const contextId = customEvent.detail?.contextId;
      if (!contextId) return;
      
      // Load context from localStorage
      const savedContext = localStorage.getItem(`lazy-writer-context-${contextId}`);
      if (savedContext) {
        setContext(savedContext);
        localStorage.setItem("lazy-writer-context", savedContext);
      }
      
      // Load conversation history
      const historyStr = localStorage.getItem(`lazy-writer-history-${contextId}`);
      if (historyStr) {
        try {
          const history = JSON.parse(historyStr);
          setConversationHistory(Array.isArray(history) ? history : []);
        } catch (e) {
          console.error("Error parsing conversation history:", e);
          setConversationHistory([]);
        }
      } else {
        setConversationHistory([]);
      }
      
      // Set active context ID
      setActiveContextId(contextId);
      localStorage.setItem("lazy-writer-active-context-id", contextId);
      
      // Notify sidebar
      window.dispatchEvent(new CustomEvent("conversation-loaded", { detail: { contextId } }));
      
      // Focus on context textarea
      setTimeout(() => {
        const contextTextarea = document.getElementById("context");
        if (contextTextarea) {
          contextTextarea.focus();
        }
      }, 100);
    };
    
    window.addEventListener("conversation-updated", handleConversationUpdate);
    window.addEventListener("new-conversation", handleNewConversation);
    window.addEventListener("load-conversation", handleLoadConversation as EventListener);
    
    return () => {
      window.removeEventListener("conversation-updated", handleConversationUpdate);
      window.removeEventListener("new-conversation", handleNewConversation);
      window.removeEventListener("load-conversation", handleLoadConversation as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveApiKey = async () => {
    const keyToSave = apiKey.trim();
    if (keyToSave && !keyToSave.includes("*")) {
      setIsTesting(true);
      setTestError("");

      try {
        const response = await fetch("/api/test-gemini-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey: keyToSave, model: model }),
        });

        const data = await response.json();

        if (data.valid) {
          // Save the actual key
          localStorage.setItem("lazy-writer-api-key", keyToSave);
          setActualApiKey(keyToSave);
          // Show masked version
          const masked = keyToSave.substring(0, 3) + "*".repeat(Math.max(0, keyToSave.length - 6)) + keyToSave.substring(keyToSave.length - 3);
          setApiKey(masked);
          setIsApiKeySaved(true);
          setTestError("");
          setGreeting(data.greeting || "");
          
          // Load available models after successful API key save
          loadModels(keyToSave);
        } else {
          setTestError(data.error || "Invalid API key");
          setIsApiKeySaved(false);
          setGreeting("");
          setModels([]);
        }
      } catch (error) {
        setTestError("Failed to test API key. Please try again.");
        setIsApiKeySaved(false);
      } finally {
        setIsTesting(false);
      }
    }
  };

  const handleQuestionMe = () => {
    // Prevent multiple clicks
    if (isNavigating) return;
    
    const contextToUse = context.trim();
    if (!contextToUse) return;

    // Disable button immediately
    setIsNavigating(true);

    // Store context in localStorage
    localStorage.setItem("lazy-writer-context", contextToUse);
    
    // Use existing contextId if we're continuing a conversation, otherwise generate new one
    let contextId = activeContextId;
    if (!contextId) {
      // Generate context ID from first 10 characters (sanitized for URL)
      contextId = contextToUse
        .substring(0, 10)
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase() || "context";
    }
    
    // Store context with ID for retrieval
    localStorage.setItem(`lazy-writer-context-${contextId}`, contextToUse);
    
    // Store conversation history if it exists
    if (conversationHistory.length > 0) {
      localStorage.setItem(`lazy-writer-history-${contextId}`, JSON.stringify(conversationHistory));
    }
    
    // Store active context ID
    localStorage.setItem("lazy-writer-active-context-id", contextId);
    
    // Store model for this session
    localStorage.setItem("lazy-writer-model", model);
    
    // Store mode for this session
    localStorage.setItem("lazy-writer-mode", mode);
    
    // Notify sidebar of conversation update
    window.dispatchEvent(new Event("conversation-updated"));
    window.dispatchEvent(new CustomEvent("conversation-loaded", { detail: { contextId } }));
    
    // Navigate immediately using replace to avoid history issues, with mode as query param
    router.replace(`/${contextId}?mode=${mode}`);
  };

  // Notify sidebar of context changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("context-changed", { detail: context }));
    
    // If user clears context, clear active context ID
    // This allows them to start a new conversation even if they had one loaded
    if (!context.trim() && activeContextId) {
      setActiveContextId(null);
      localStorage.removeItem("lazy-writer-active-context-id");
      setConversationHistory([]);
      // Notify sidebar to clear active state
      window.dispatchEvent(new CustomEvent("conversation-cleared"));
    }
  }, [context, activeContextId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className={`${conversationHistory.length > 0 ? "flex flex-col lg:flex-row gap-6 items-start" : ""}`}>
        {/* Left Side: Main Content */}
        <div className={`${conversationHistory.length > 0 ? "flex-1 w-full lg:w-auto" : "w-full"}`}>
          {/* Mode Tabs */}
          <div className="mb-4 lg:mb-6">
            <div className="flex gap-2 border-b border-white/30">
              <button
                onClick={() => {
                  setMode("writer");
                  localStorage.setItem("lazy-writer-mode", "writer");
                }}
                className={`px-4 py-2 text-sm lg:text-base font-medium transition-colors border-b-2 ${
                  mode === "writer"
                    ? "border-[#fbbc4f] text-[#fbbc4f]"
                    : "border-transparent text-white/70 hover:text-white"
                }`}
              >
                Writer
              </button>
              <button
                onClick={() => {
                  setMode("quiz");
                  localStorage.setItem("lazy-writer-mode", "quiz");
                }}
                className={`px-4 py-2 text-sm lg:text-base font-medium transition-colors border-b-2 ${
                  mode === "quiz"
                    ? "border-[#fbbc4f] text-[#fbbc4f]"
                    : "border-transparent text-white/70 hover:text-white"
                }`}
              >
                Quizer
              </button>
            </div>
          </div>
          
          {/* API Key Field */}
      <div className="mb-4 lg:mb-6">
        <label htmlFor="api-key" className="block text-base lg:text-lg font-medium mb-2">
          Gemini API Key
        </label>
        <div className="flex items-center gap-2">
          <input
            id="api-key"
            type="text"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsApiKeySaved(false);
              setGreeting("");
            }}
            placeholder="AIz******************..."
            className="flex-1 p-2.5 lg:p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f] text-sm lg:text-base"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={isTesting || apiKey.trim().includes("*")}
            className={`p-2.5 lg:p-3 rounded transition-colors min-w-[44px] min-h-[44px] ${
              isApiKeySaved
                ? "bg-[#fbbc4f] text-black"
                : "bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
            title={isApiKeySaved ? "API Key saved" : "Save API Key"}
          >
            {isTesting ? (
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
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            )}
          </button>
        </div>
        {testError && (
          <p className="text-sm text-red-400 mt-2">
            {testError}
          </p>
        )}
        {isApiKeySaved && !testError && greeting && (
          <p className="text-sm text-green-400 mt-2">
            {greeting}
          </p>
        )}
      </div>
      {!actualApiKey && (
        <p className="text-sm text-white/70 mt-2">
          Get your Google Gemini API Key from{" "}
          <a
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fbbc4f] hover:underline"
          >
            https://aistudio.google.com/api-keys
          </a>
          .
        </p>
      )}
      <p className="text-sm text-white/70 mt-2 mb-4">
        Your API key is stored in your browser's local storage.
      </p>
      
      {/* Model Selection */}
      <div className="mb-4 lg:mb-6">
        <label htmlFor="model" className="block text-base lg:text-lg font-medium mb-2">
          Model
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            localStorage.setItem("lazy-writer-model", e.target.value);
          }}
          disabled={!isApiKeySaved || isLoadingModels || models.length === 0}
          className="w-full p-2.5 lg:p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f] disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base min-h-[44px]"
        >
          {isLoadingModels ? (
            <option>Loading models...</option>
          ) : models.length === 0 ? (
            <option>No models available. Please save your API key first.</option>
          ) : (
            models.map((m) => {
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
          {isLoadingModels
            ? "Loading available models..."
            : models.length === 0
            ? "Save your API key to see available models."
            : "Select the Gemini model to use for generating questions and finalizing your essay."}
        </p>
      </div>
      
      {/* Context Field */}
      <div className="mb-4 lg:mb-6">
        <label htmlFor="context" className="block text-base lg:text-lg font-medium mb-2">
          Context
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="I went through a survival course during my time in the army. I was the leader, and I have to write an essay on my time as a leader."
          className="w-full h-40 lg:h-48 p-2.5 lg:p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm lg:text-base"
        />
      </div>

      {/* Question Me Button */}
      <button
        onClick={handleQuestionMe}
        disabled={!isApiKeySaved || !context.trim() || isNavigating}
        className="w-full py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] text-sm lg:text-base"
      >
        {isNavigating ? (
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
            <span>Loading...</span>
          </>
        ) : (
          "Question Me"
        )}
      </button>
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
    </div>
  );
}
