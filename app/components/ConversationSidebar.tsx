"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Conversation {
  contextId: string;
  context: string;
  questionCount: number;
  isNew?: boolean;
}

export default function ConversationSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentContext, setCurrentContext] = useState("");
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{ contextId: string; context: string } | null>(null);

  const loadConversations = () => {
    const loadedConversations: Conversation[] = [];
    
    // Scan localStorage for all context keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("lazy-writer-context-")) {
        const contextId = key.replace("lazy-writer-context-", "");
        
        // Skip if contextId is empty (would be the generic "lazy-writer-context" key)
        if (!contextId) continue;
        
        const context = localStorage.getItem(key) || "";
        const historyKey = `lazy-writer-history-${contextId}`;
        const historyStr = localStorage.getItem(historyKey);
        
        let questionCount = 0;
        if (historyStr) {
          try {
            const history = JSON.parse(historyStr);
            questionCount = Array.isArray(history) ? history.length : 0;
          } catch (e) {
            console.error("Error parsing history:", e);
          }
        }
        
        loadedConversations.push({
          contextId,
          context,
          questionCount,
        });
      }
    }
    
    // Sort by question count (most active first), then alphabetically by context
    loadedConversations.sort((a, b) => {
      if (b.questionCount !== a.questionCount) {
        return b.questionCount - a.questionCount;
      }
      return a.context.localeCompare(b.context);
    });
    
    setConversations(loadedConversations);
  };

  // Check if current context is a new conversation (not saved yet)
  // Only show on the main page (/) to avoid confusion on other pages
  const isMainPage = pathname === "/";
  const hasNewConversation = isMainPage && currentContext.trim().length > 0;
  const newConversationContext = currentContext.trim();

  // Load current context from localStorage
  const loadCurrentContext = () => {
    const savedContext = localStorage.getItem("lazy-writer-context") || "";
    setCurrentContext(savedContext);
  };

  useEffect(() => {
    loadConversations();
    loadCurrentContext();
    
    // Load active contextId from localStorage
    const savedActiveContextId = localStorage.getItem("lazy-writer-active-context-id");
    if (savedActiveContextId) {
      setActiveContextId(savedActiveContextId);
    }
    
    // Listen for storage changes to update the list
    const handleStorageChange = () => {
      loadConversations();
      loadCurrentContext();
    };
    
    // Listen for context changes from the main page
    const handleContextChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setCurrentContext(customEvent.detail || "");
    };
    
    // Listen for conversation load events
    const handleConversationLoad = (e: Event) => {
      const customEvent = e as CustomEvent<{ contextId: string }>;
      if (customEvent.detail?.contextId) {
        setActiveContextId(customEvent.detail.contextId);
      }
    };
    
    // Listen for conversation clear events
    const handleConversationClear = () => {
      setActiveContextId(null);
      localStorage.removeItem("lazy-writer-active-context-id");
    };
    
    // Listen for sidebar toggle from header
    const handleToggleSidebar = () => {
      setIsExpanded((prev) => !prev);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("conversation-updated", handleStorageChange);
    window.addEventListener("context-changed", handleContextChange as EventListener);
    window.addEventListener("conversation-loaded", handleConversationLoad as EventListener);
    window.addEventListener("new-conversation", handleConversationClear);
    window.addEventListener("conversation-cleared", handleConversationClear);
    window.addEventListener("toggle-sidebar", handleToggleSidebar);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("conversation-updated", handleStorageChange);
      window.removeEventListener("context-changed", handleContextChange as EventListener);
      window.removeEventListener("conversation-loaded", handleConversationLoad as EventListener);
      window.removeEventListener("new-conversation", handleConversationClear);
      window.removeEventListener("conversation-cleared", handleConversationClear);
      window.removeEventListener("toggle-sidebar", handleToggleSidebar);
    };
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, contextId: string, context: string) => {
    e.stopPropagation();
    setConversationToDelete({ contextId, context });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (!conversationToDelete) return;
    
    const { contextId } = conversationToDelete;
    localStorage.removeItem(`lazy-writer-context-${contextId}`);
    localStorage.removeItem(`lazy-writer-history-${contextId}`);
    
    // Clear active context ID if deleting the active conversation
    if (activeContextId === contextId) {
      setActiveContextId(null);
      localStorage.removeItem("lazy-writer-active-context-id");
    }
    
    loadConversations();
    setShowDeleteModal(false);
    setConversationToDelete(null);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("conversation-updated"));
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setConversationToDelete(null);
  };

  const handleLoadConversation = (contextId: string) => {
    // Dispatch event to load conversation into main page
    window.dispatchEvent(new CustomEvent("load-conversation", { 
      detail: { contextId } 
    }));
    
    // Navigate to home if not already there
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const handleNewConversation = () => {
    // Clear the generic context from localStorage
    localStorage.removeItem("lazy-writer-context");
    localStorage.removeItem("lazy-writer-active-context-id");
    
    // Clear active context ID
    setActiveContextId(null);
    
    // Dispatch event to notify main page to clear form
    window.dispatchEvent(new CustomEvent("new-conversation"));
    
    // Navigate to home if not already there
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div className={`flex flex-col h-full bg-black border-r border-white/20 transition-all duration-300 ${
        isExpanded ? "w-80" : "w-12"
      } fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto ${
        isExpanded ? "" : "-translate-x-full lg:translate-x-0"
      }`}>
      {/* Header with toggle */}
      <div className={`${isExpanded ? "p-4" : "p-2"} border-b border-white/20 flex items-center justify-between`}>
        {isExpanded ? (
          <>
            <h2 className="text-lg font-semibold text-white">Conversations</h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              aria-label="Collapse sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5 text-white transition-transform"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex justify-center p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Expand sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* New Conversation Button */}
          <div className="p-4 border-b border-white/20">
            <button
              onClick={handleNewConversation}
              className="w-full py-2 px-4 bg-[#fbbc4f] text-black font-medium rounded transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              New Conversation
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && !hasNewConversation ? (
              <div className="p-4 text-white/60 text-sm text-center">
                No conversations yet. Start a new one!
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* New Conversation Item (if typing) */}
                {hasNewConversation && (
                  <div className="p-3 rounded border border-[#fbbc4f]/50 bg-[#fbbc4f]/10 cursor-default">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#fbbc4f] text-xs font-semibold mb-1 uppercase tracking-wide">
                          New conversation
                        </p>
                        <p className="text-white text-sm font-medium truncate">
                          {newConversationContext ? truncateText(newConversationContext) : "Start typing..."}
                        </p>
                        <p className="text-white/40 text-xs mt-1">
                          Not saved yet
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Existing Conversations */}
                {conversations.map((conv) => {
                  const isActive = activeContextId === conv.contextId;
                  return (
                  <div
                    key={conv.contextId}
                    onClick={() => handleLoadConversation(conv.contextId)}
                    className={`group relative p-3 rounded cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#fbbc4f]/20 border border-[#fbbc4f]/50"
                        : "border border-transparent hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {truncateText(conv.context)}
                        </p>
                        <p className="text-white/60 text-xs mt-1">
                          {conv.questionCount} {conv.questionCount === 1 ? "question" : "questions"}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClick(e, conv.contextId, conv.context)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all shrink-0"
                        aria-label="Delete conversation"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-4 h-4 text-red-400"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && conversationToDelete && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={handleDeleteCancel}
        >
          <div 
            className="bg-black border-2 border-white rounded-lg max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Delete Conversation</h2>
            
            <p className="text-white/90 text-sm sm:text-base">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>

            {/* Conversation Preview */}
            <div className="p-3 sm:p-4 bg-white/5 border border-white/20 rounded">
              <p className="text-white/60 text-xs mb-2">Conversation:</p>
              <p className="text-white text-xs sm:text-sm">
                {truncateText(conversationToDelete.context, 100)}
              </p>
            </div>

            {/* Modal Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 py-3 px-6 bg-white/20 text-white font-medium rounded transition-opacity hover:opacity-90 min-h-[44px] text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors min-h-[44px] text-sm sm:text-base"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

