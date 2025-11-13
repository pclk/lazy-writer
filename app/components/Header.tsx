"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const handleLazyWriterClick = (e: React.MouseEvent) => {
    // Clear context and conversation state
    localStorage.removeItem("lazy-writer-context");
    localStorage.removeItem("lazy-writer-active-context-id");
    
    // Dispatch event to clear form
    window.dispatchEvent(new CustomEvent("new-conversation"));
    
    // If already on home page, prevent navigation and just clear
    if (pathname === "/") {
      e.preventDefault();
    }
  };

  const handleMenuClick = () => {
    // Dispatch event to toggle sidebar
    window.dispatchEvent(new CustomEvent("toggle-sidebar"));
  };

  return (
    <header className="flex items-center justify-between lg:justify-center border-b border-white px-4 lg:px-0">
      {/* Mobile menu button */}
      <button
        onClick={handleMenuClick}
        className="lg:hidden p-2 text-white hover:text-[#fbbc4f] transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {/* Navigation links */}
      <div className="flex items-center justify-center flex-1 lg:flex-none">
        <Link
          href="/"
          onClick={handleLazyWriterClick}
          className={`px-3 py-3 lg:px-6 lg:py-6 text-xl lg:text-4xl font-bold transition-colors ${
            isActive("/")
              ? "text-[#fbbc4f] underline"
              : "text-white hover:text-[#fbbc4f]"
          }`}
        >
          Lazy Writer
        </Link>
        <div className="h-6 lg:h-10 w-px bg-white mx-2 lg:mx-0" />
        <Link
          href="/help"
          className={`px-3 py-2 lg:px-6 lg:py-4 text-xl lg:text-4xl font-bold transition-colors ${
            isActive("/help")
              ? "text-[#fbbc4f]"
              : "text-white hover:text-[#fbbc4f]"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6 lg:w-10 lg:h-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
            />
          </svg>
        </Link>
        <div className="h-6 lg:h-10 w-px bg-white mx-2 lg:mx-0" />
        <Link
          href="/settings"
          className={`px-3 py-3 lg:px-6 lg:py-6 text-xl lg:text-4xl font-bold transition-colors ${
            isActive("/settings")
              ? "text-[#fbbc4f] underline"
              : "text-white hover:text-[#fbbc4f]"
          }`}
        >
          Settings
        </Link>
      </div>

      {/* Spacer for mobile to balance the menu button */}
      <div className="lg:hidden w-10" />
    </header>
  );
}

