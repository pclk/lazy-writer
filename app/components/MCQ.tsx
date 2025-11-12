"use client";

interface MCQProps {
  question: string;
  options: string[];
  selectedOptions: number[];
  freeText: string;
  onSelect: (index: number) => void;
  onFreeTextChange: (text: string) => void;
}

export default function MCQ({ 
  question, 
  options, 
  selectedOptions, 
  freeText,
  onSelect, 
  onFreeTextChange
}: MCQProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white mb-6">{question}</h2>
      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => onSelect(index)}
            className={`w-full text-left p-4 rounded border-2 transition-all ${
              selectedOptions.includes(index)
                ? "border-[#fbbc4f] bg-[#fbbc4f]/10 text-white"
                : "border-white text-white hover:border-[#fbbc4f]/50 hover:bg-black/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 ${
                  selectedOptions.includes(index)
                    ? "border-[#fbbc4f] bg-[#fbbc4f]"
                    : "border-white"
                }`}
              >
                {selectedOptions.includes(index) && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                    className="w-4 h-4 text-black"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                )}
              </div>
              <span className="flex-1">{option}</span>
            </div>
          </button>
        ))}
      </div>
      
      {/* Free text input */}
      <div className="mt-6">
        <label htmlFor="free-text" className="block text-sm font-medium mb-2 text-white">
          Additional thoughts (optional)
        </label>
        <textarea
          id="free-text"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder="Add any additional context or thoughts here..."
          className="w-full h-32 p-3 bg-black border border-white text-white rounded resize-none focus:outline-none focus:border-[#fbbc4f]"
        />
      </div>
    </div>
  );
}

