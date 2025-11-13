"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [quizPrompt, setQuizPrompt] = useState("");

  useEffect(() => {
    // Load system prompt from localStorage first
    const savedSystem = localStorage.getItem("lazy-writer-system-prompt");
    if (savedSystem) {
      setSystemPrompt(savedSystem);
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

    // Load question prompt from localStorage first
    const savedQuestion = localStorage.getItem("lazy-writer-question-prompt");
    if (savedQuestion) {
      setQuestionPrompt(savedQuestion);
    } else {
      // If no saved value, load default from file
      fetch("/api/question-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setQuestionPrompt(data.prompt);
            // Save default to localStorage
            localStorage.setItem("lazy-writer-question-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading default question prompt:", error);
        });
    }

    // Load quiz prompt from localStorage first
    const savedQuiz = localStorage.getItem("lazy-writer-quiz-prompt");
    if (savedQuiz) {
      setQuizPrompt(savedQuiz);
    } else {
      // If no saved value, load default from file
      fetch("/api/quiz-prompt")
        .then((res) => res.json())
        .then((data) => {
          if (data.prompt) {
            setQuizPrompt(data.prompt);
            // Save default to localStorage
            localStorage.setItem("lazy-writer-quiz-prompt", data.prompt);
          }
        })
        .catch((error) => {
          console.error("Error loading default quiz prompt:", error);
        });
    }
  }, []);

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSystemPrompt(value);
    // Auto-save to localStorage
    localStorage.setItem("lazy-writer-system-prompt", value);
  };

  const handleQuestionPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuestionPrompt(value);
    // Auto-save to localStorage
    localStorage.setItem("lazy-writer-question-prompt", value);
  };

  const handleQuizPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuizPrompt(value);
    // Auto-save to localStorage
    localStorage.setItem("lazy-writer-quiz-prompt", value);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">      
      <div>
        <label htmlFor="system-prompt" className="block text-base sm:text-lg font-medium mb-3 sm:mb-4">
          System Prompt
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          className="w-full h-48 sm:h-64 p-3 sm:p-4 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm sm:text-base"
          placeholder="Enter your system prompt here..."
        />
        <p className="text-xs sm:text-sm text-white/70 mt-2">
          Changes are automatically saved to your browser's local storage.
        </p>
      </div>

      <div>
        <label htmlFor="question-prompt" className="block text-base sm:text-lg font-medium mb-3 sm:mb-4">
          Question Prompt (Writer Mode)
        </label>
        <textarea
          id="question-prompt"
          value={questionPrompt}
          onChange={handleQuestionPromptChange}
          className="w-full h-48 sm:h-64 p-3 sm:p-4 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm sm:text-base"
          placeholder="Enter your question prompt here..."
        />
        <p className="text-xs sm:text-sm text-white/70 mt-2">
          Changes are automatically saved to your browser's local storage.
        </p>
      </div>

      <div>
        <label htmlFor="quiz-prompt" className="block text-base sm:text-lg font-medium mb-3 sm:mb-4">
          Quiz Prompt (Quizer Mode)
        </label>
        <textarea
          id="quiz-prompt"
          value={quizPrompt}
          onChange={handleQuizPromptChange}
          className="w-full h-48 sm:h-64 p-3 sm:p-4 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm sm:text-base"
          placeholder="Enter your quiz prompt here..."
        />
        <p className="text-xs sm:text-sm text-white/70 mt-2">
          Changes are automatically saved to your browser's local storage.
        </p>
      </div>
    </div>
  );
}

