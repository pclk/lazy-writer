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

      <section className="mb-8 sm:mb-12">
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

      <section className="mb-8 sm:mb-12">
        <h1 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Google Gemini API Keys: Free vs Paid</h1>
        
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Getting a Free API Key</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <p>
                To get started with a free Google Gemini API key:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>
                  Visit{" "}
                  <a
                    href="https://aistudio.google.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fbbc4f] hover:underline"
                  >
                    Google AI Studio
                  </a>{" "}
                  and sign in with your Google account
                </li>
                <li>Click "Create API Key" or "Get API Key"</li>
                <li>Select or create a Google Cloud project (you can use the default project)</li>
                <li>Copy your API key and paste it into Lazy Writer</li>
              </ol>
              <p className="mt-3 sm:mt-4">
                <strong className="text-white">Note:</strong> Free API keys are perfect for testing, personal use, and small projects.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Free Tier Limitations</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <p>The free tier includes:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Limited requests per day (varies by model)</li>
                <li>Rate limits to prevent abuse</li>
                <li>Access to certain Gemini models</li>
                <li>Your prompts and responses may be used to improve Google products</li>
              </ul>
              <p className="mt-3 sm:mt-4">
                If you encounter rate limit errors or "quota exceeded" messages, you may need to wait or upgrade to a paid plan.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Upgrading to Paid Tier</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <p>
                For production use, higher volumes, or when you need more reliable access:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to{" "}
                  <a
                    href="https://aistudio.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fbbc4f] hover:underline"
                  >
                    Google AI Studio
                  </a>
                </li>
                <li>Navigate to Settings → Plan information</li>
                <li>Click "Set up Billing" for your project</li>
                <li>Follow the prompts to enable Google Cloud Billing</li>
                <li>Set up billing alerts to monitor your usage</li>
              </ol>
              <p className="mt-3 sm:mt-4">
                <strong className="text-white">Important:</strong> Once billing is enabled, all API usage becomes billable. 
                Make sure to set up billing alerts and monitor your usage in the Google Cloud Console to avoid unexpected charges.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Free vs Paid: Key Differences</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <div className="bg-black/50 border border-white/30 rounded-lg p-4 sm:p-6">
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="border-b border-white/30">
                      <th className="text-left py-2 pr-4 text-white font-semibold">Feature</th>
                      <th className="text-left py-2 pr-4 text-white font-semibold">Free Tier</th>
                      <th className="text-left py-2 text-white font-semibold">Paid Tier</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/90">
                    <tr className="border-b border-white/20">
                      <td className="py-2 pr-4">Cost</td>
                      <td className="py-2 pr-4">Free</td>
                      <td className="py-2">Pay-as-you-go</td>
                    </tr>
                    <tr className="border-b border-white/20">
                      <td className="py-2 pr-4">Rate Limits</td>
                      <td className="py-2 pr-4">Lower limits</td>
                      <td className="py-2">Higher limits</td>
                    </tr>
                    <tr className="border-b border-white/20">
                      <td className="py-2 pr-4">Data Usage</td>
                      <td className="py-2 pr-4">May be used to improve products</td>
                      <td className="py-2">Not used for training</td>
                    </tr>
                    <tr className="border-b border-white/20">
                      <td className="py-2 pr-4">Reliability</td>
                      <td className="py-2 pr-4">Subject to quota limits</td>
                      <td className="py-2">More reliable access</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Best For</td>
                      <td className="py-2 pr-4">Testing, personal use</td>
                      <td className="py-2">Production, high volume</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Tips & Best Practices</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong className="text-white">Start with free:</strong> Use the free tier to test Lazy Writer and see if it meets your needs
                </li>
                <li>
                  <strong className="text-white">Monitor usage:</strong> Keep track of your API calls, especially if you're on the free tier
                </li>
                <li>
                  <strong className="text-white">Set billing alerts:</strong> If you upgrade to paid, set up alerts to avoid unexpected charges
                </li>
                <li>
                  <strong className="text-white">Keep your key secure:</strong> Never share your API key publicly or commit it to version control
                </li>
                <li>
                  <strong className="text-white">Check pricing:</strong> Review{" "}
                  <a
                    href="https://ai.google.dev/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fbbc4f] hover:underline"
                  >
                    Google's pricing page
                  </a>{" "}
                  for current rates before upgrading
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white">Troubleshooting</h2>
            <div className="text-white leading-relaxed space-y-3 sm:space-y-4 text-sm sm:text-base">
              <p><strong className="text-white">"Quota exceeded" or rate limit errors:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Wait a few minutes and try again (free tier has daily limits)</li>
                <li>Check if you've exceeded your daily quota</li>
                <li>Consider upgrading to paid tier for higher limits</li>
              </ul>
              <p className="mt-3 sm:mt-4"><strong className="text-white">"Invalid API key" errors:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Verify you copied the entire API key correctly</li>
                <li>Make sure there are no extra spaces before or after the key</li>
                <li>Check if the API key is still active in Google AI Studio</li>
                <li>Try generating a new API key if the issue persists</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

