"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    // Load from localStorage first
    const saved = localStorage.getItem("lazy-writer-system-prompt");
    if (saved) {
      setSystemPrompt(saved);
    } else {
      // If no saved value, load default from file
      fetch("/api/system-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setSystemPrompt(data.prompt);
            // Save default to localStorage
            localStorage.setItem("lazy-writer-system-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading default system prompt:", error);
        });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSystemPrompt(value);
    // Auto-save to localStorage
    localStorage.setItem("lazy-writer-system-prompt", value);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">      
      <div>
        <label htmlFor="system-prompt" className="block text-lg font-medium mb-4">
          System Prompt
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleChange}
          className="w-full h-64 p-4 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f]"
          placeholder="Enter your system prompt here..."
        />
        <p className="text-sm text-white/70 mt-2">
          Changes are automatically saved to your browser's local storage.
        </p>
      </div>
    </div>
  );
}

