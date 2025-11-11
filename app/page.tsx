"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [context, setContext] = useState("");
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [actualApiKey, setActualApiKey] = useState("");

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
  }, []);

  const handleSaveApiKey = () => {
    const keyToSave = apiKey.trim();
    if (keyToSave && !keyToSave.includes("*")) {
      // Save the actual key
      localStorage.setItem("lazy-writer-api-key", keyToSave);
      setActualApiKey(keyToSave);
      // Show masked version
      const masked = keyToSave.substring(0, 3) + "*".repeat(Math.max(0, keyToSave.length - 6)) + keyToSave.substring(keyToSave.length - 3);
      setApiKey(masked);
      setIsApiKeySaved(true);
    }
  };

  const handleQuestionMe = () => {
    // Store context in localStorage for the questioning process
    if (context.trim()) {
      localStorage.setItem("lazy-writer-context", context.trim());
    }
    // TODO: Start the questioning process
    // For now, just log
    console.log("Starting questioning process...");
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
            }}
            placeholder="AIz******************..."
            className="flex-1 p-3 bg-black border border-white text-white rounded focus:outline-none focus:border-[#fbbc4f]"
          />
          <button
            onClick={handleSaveApiKey}
            className={`p-3 rounded transition-colors ${
              isApiKeySaved
                ? "bg-[#fbbc4f] text-black"
                : "bg-white text-black hover:bg-gray-200"
            }`}
            title={isApiKeySaved ? "API Key saved" : "Save API Key"}
          >
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
          </button>
        </div>
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
        disabled={!isApiKeySaved || !context.trim()}
        className="w-full py-3 px-6 bg-white text-black font-medium rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Question Me
      </button>
    </div>
  );
}
