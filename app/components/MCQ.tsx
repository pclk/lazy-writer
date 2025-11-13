"use client";

interface MCQProps {
  question: string;
  options: string[];
  selectedOptions: number[];
  freeText: string;
  onSelect: (index: number) => void;
  onFreeTextChange: (text: string) => void;
  feedback?: Array<{ index: number; isCorrect: boolean; explanation: string }>;
  correctIndices?: number[];
}

export default function MCQ({ 
  question, 
  options, 
  selectedOptions, 
  freeText,
  onSelect, 
  onFreeTextChange,
  feedback,
  correctIndices
}: MCQProps) {
  const hasFeedback = feedback && feedback.length > 0;
  const getOptionFeedback = (index: number) => {
    if (!hasFeedback) return null;
    return feedback.find(f => f.index === index);
  };
  
  const isCorrectOption = (index: number) => {
    return correctIndices?.includes(index) || false;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-4 sm:mb-6">{question}</h2>
      <div className="space-y-2 sm:space-y-3">
        {options.map((option, index) => {
          const optionFeedback = getOptionFeedback(index);
          const isCorrect = isCorrectOption(index);
          const showFeedback = hasFeedback && optionFeedback;
          
          return (
            <button
              key={index}
              onClick={() => !showFeedback && onSelect(index)}
              disabled={!!showFeedback}
              className={`w-full text-left p-3 sm:p-4 rounded border-2 transition-all min-h-[44px] ${
                showFeedback
                  ? optionFeedback!.isCorrect
                    ? "border-green-500 bg-green-950/20 text-white cursor-default"
                    : "border-red-500 bg-red-950/20 text-white cursor-default"
                  : selectedOptions.includes(index)
                  ? "border-[#fbbc4f] bg-[#fbbc4f]/10 text-white"
                  : "border-white text-white hover:border-[#fbbc4f]/50 hover:bg-black/50"
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div
                  className={`shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center mt-0.5 ${
                    showFeedback
                      ? optionFeedback!.isCorrect
                        ? "border-green-500 bg-green-500"
                        : "border-red-500 bg-red-500"
                      : selectedOptions.includes(index)
                      ? "border-[#fbbc4f] bg-[#fbbc4f]"
                      : "border-white"
                  }`}
                >
                  {showFeedback ? (
                    <span className="text-white text-xs sm:text-sm font-bold">
                      {optionFeedback!.isCorrect ? "✓" : "✗"}
                    </span>
                  ) : selectedOptions.includes(index) ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="w-3 h-3 sm:w-4 sm:h-4 text-black"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : null}
                </div>
                <div className="flex-1">
                  <span className="text-sm sm:text-base block">{option}</span>
                  {showFeedback && optionFeedback!.explanation && (
                    <p className="text-xs sm:text-sm mt-1 opacity-80">{optionFeedback!.explanation}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Free text input */}
      <div className="mt-4 sm:mt-6">
        <label htmlFor="free-text" className="block text-xs sm:text-sm font-medium mb-2 text-white">
          Additional thoughts (optional)
        </label>
        <textarea
          id="free-text"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder="Add any additional context or thoughts here..."
          className="w-full h-28 sm:h-32 p-2.5 sm:p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f] text-sm sm:text-base"
        />
      </div>
    </div>
  );
}

