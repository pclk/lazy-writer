"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [context, setContext] = useState("");
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [actualApiKey, setActualApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [greeting, setGreeting] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

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
    
    // Load saved context if exists
    const savedContext = localStorage.getItem("lazy-writer-context");
    if (savedContext) {
      setContext(savedContext);
    }
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
          body: JSON.stringify({ apiKey: keyToSave }),
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
        } else {
          setTestError(data.error || "Invalid API key");
          setIsApiKeySaved(false);
          setGreeting("");
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
    
    // Generate context ID from first 10 characters (sanitized for URL)
    const contextId = contextToUse
      .substring(0, 10)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase() || "context";
    
    // Store context with ID for retrieval
    localStorage.setItem(`lazy-writer-context-${contextId}`, contextToUse);
    
    // Navigate immediately using replace to avoid history issues
    router.replace(`/${contextId}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* API Key Field */}
      <div className="">
        <label htmlFor="api-key" className="block text-lg font-medium mb-2">
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
            className="flex-1 p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f]"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={isTesting || apiKey.trim().includes("*")}
            className={`p-3 rounded transition-colors ${
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
      <p className="text-sm text-white/70 mt-2 mb-4">
        Your API key is stored in your browser's local storage.
      </p>
      {/* Context Field */}
      <div className="mb-6">
        <label htmlFor="context" className="block text-lg font-medium mb-2">
          Context
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="I went through a survival course during my time in the army. I was the leader, and I have to write an essay on my time as a leader."
          className="w-full h-48 p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f]"
        />
      </div>

      {/* Question Me Button */}
      <button
        onClick={handleQuestionMe}
        disabled={!isApiKeySaved || !context.trim() || isNavigating}
        className="w-full py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  );
}
