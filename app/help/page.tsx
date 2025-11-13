export default function HelpPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">      
      <section className="mb-8 sm:mb-12">
        <h1 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">About</h1>
        <p className="text-white leading-relaxed text-sm sm:text-base">
          Ever feel too lazy to write an essay but don't want it to be generic AI slop? Welcome to Lazy Writer!
        </p>
        <p className="text-white leading-relaxed mt-3 sm:mt-4 text-sm sm:text-base">
          Lazy Writer takes your context and transforms your essay writing process into an intuitive form experience. 
          The AI asks questions, you simply answer them. Sometimes, the AI might even provide you the answers you want, 
          and all you have to do is to select it!
        </p>
        <p className="text-white leading-relaxed mt-3 sm:mt-4 text-sm sm:text-base">
          Good for explorative writing, lazy writers, and forming a cohesive, well-thought out message for any occasion.
        </p>
      </section>

      <section>
        <h1 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">How to use</h1>
        <div className="text-white leading-relaxed space-y-3 sm:space-y-4">
          <p className="text-sm sm:text-base">
            Start by retrieving your Google Gemini Key from{" "}
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
          <p className="text-sm sm:text-base">Enter your context, then start questioning.</p>
          <p className="text-sm sm:text-base">
            At any point if you wish to restart back to the context menu, you can tap/click on Lazy Writer title at the top left.
          </p>
        </div>
      </section>
    </div>
  );
}

