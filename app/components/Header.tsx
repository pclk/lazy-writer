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

  return (
    <header className="flex items-center justify-center border-b border-white">
      <Link
        href="/"
        onClick={handleLazyWriterClick}
        className={`px-6 py-6 text-4xl font-bold transition-colors ${
          isActive("/")
            ? "text-[#fbbc4f] underline"
            : "text-white hover:text-[#fbbc4f]"
        }`}
      >
        Lazy Writer
      </Link>
      <div className="h-10 w-px bg-white" />
      <Link
        href="/help"
        className={`px-6 py-4 text-4xl font-bold transition-colors ${
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
          className="w-10 h-10"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
          />
        </svg>
      </Link>
      <div className="h-10 w-px bg-white" />
      <Link
        href="/settings"
        className={`px-6 py-6 text-4xl font-bold transition-colors ${
          isActive("/settings")
            ? "text-[#fbbc4f] underline"
            : "text-white hover:text-[#fbbc4f]"
        }`}
      >
        Settings
      </Link>
    </header>
  );
}

