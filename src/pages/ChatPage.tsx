import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom"; // Import useParams
import { invoke } from "@tauri-apps/api/core";
import Database from '@tauri-apps/plugin-sql'; // Keep type import if needed elsewhere, but instance comes via prop
import "../App.css"; // Adjust path if needed? Should be correct if App.css is in src/

interface LocalOllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface ChatMessageUI {
  role: 'user' | 'assistant' | 'system'; // Allow system role
  content: string;
}

// Type for the props including the db instance
interface ChatPageProps {
  db: Database; // Receive db instance as a prop
}

function ChatPage({ db }: ChatPageProps) {
  const { conversationId } = useParams<{ conversationId: string }>(); // Get ID from URL
  const currentConversationId = Number(conversationId); // Convert to number

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [listModels, setListModels] = useState<LocalOllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [conversation, setConversation] = useState<ChatMessageUI[]>([]); // UI message state

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // --- Load Models (Doesn't need DB) ---
  const getListModels = useCallback(async () => {
    setError("");
    setListModels([]);
    console.log("Attempting to invoke 'get_ollama_models'...");
    try {
      const results: LocalOllamaModel[] = await invoke("get_ollama_models");
      console.log("Successfully invoked 'get_ollama_models'. Results:", results);
      setListModels(results);
      if (results.length > 0 && !selectedModel) {
        setSelectedModel(results[0].name);
      } else if (results.length > 0 && !results.some(m => m.name === selectedModel)){
        setSelectedModel(results[0].name);
      } else if (results.length === 0) {
          setSelectedModel("");
      }
    } catch (err: any) {
      console.error("Error invoking 'get_ollama_models':", err);
      setError(`Failed to get models: ${err?.message || err}`);
      setListModels([]);
      setSelectedModel("");
    }
  }, [selectedModel]); // Re-run if selectedModel changes? Maybe not necessary here.

   // --- Load History for Current Conversation ---
   const loadHistoryFromDb = useCallback(async () => {
    if (!db || !currentConversationId || isNaN(currentConversationId)) {
      console.warn("DB not available or invalid conversationId to load history");
      // setError("Cannot load history: Database not connected or invalid chat ID.");
      setConversation([]); // Clear conversation if ID is invalid
      return;
    }
    setError(""); // Clear previous errors
    setIsLoading(true); // Indicate loading history
    try {
      console.log(`Loading history from DB for conversation ${currentConversationId}...`);
      // Use parameter binding $1
      const loadedMessages: ChatMessageUI[] = await db.select(
        "SELECT role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY timestamp ASC",
        [currentConversationId] // Pass ID as parameter
      );
      setConversation(loadedMessages); // Update UI state
      console.log(`Loaded ${loadedMessages.length} messages from history for conversation ${currentConversationId}.`);
    } catch (historyError: any) {
      console.error("Error loading history from DB:", historyError);
      setError(`Failed to load history: ${historyError?.message || historyError}`);
      setConversation([]); // Clear conversation on error
    } finally {
        setIsLoading(false);
    }
  }, [db, currentConversationId]); // Depend on db instance and conversationId

  // --- Initial data load and re-load when conversationId changes ---
  useEffect(() => {
    getListModels(); // Load models on mount
  }, [getListModels]);

  useEffect(() => {
    if (currentConversationId) {
        loadHistoryFromDb(); // Load history when conversationId changes
    } else {
        setConversation([]); // Clear conversation if no ID
    }
  }, [currentConversationId, loadHistoryFromDb]); // Add loadHistoryFromDb dependency

  // --- Handle Sending Prompt ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentPrompt = prompt.trim();
    if (!currentPrompt || !selectedModel || isLoading || !db || !currentConversationId) return;

    const userMessage: ChatMessageUI = { role: 'user', content: currentPrompt };

    // 1. Optimistically update UI state
    // We fetch history below, so maybe don't need optimistic update here,
    // or maybe just add user message? Let's try adding user msg.
    setConversation(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);
    setError("");

    try {
      // 2. Fetch current history AND global context for the backend call
      console.log(`Fetching context and history for conversation ${currentConversationId}...`);
      const historyMessages: ChatMessageUI[] = await db.select(
         "SELECT role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY timestamp ASC",
         [currentConversationId]
       );

      const contextResult: Array<{ value: string }> = await db.select(
          "SELECT value FROM settings WHERE key = $1",
          ["global_system_prompt"]
      );
      const globalContext = contextResult.length > 0 ? contextResult[0].value : "You are a helpful assistant."; // Default fallback

       // 3. Construct messages for LLM (Context + History + New User Message)
       const messages_for_llm = [];
       if (globalContext) {
           messages_for_llm.push({ role: 'system', content: globalContext });
       }
       messages_for_llm.push(...historyMessages); // Add historical messages
       messages_for_llm.push(userMessage); // Add the new user message

      // 4. Call Backend (simplified ask_llm)
      console.log("Invoking ask_llm with context...");
      const assistantResponseContent: string = await invoke("ask_llm", {
        messages: messages_for_llm, // Send constructed context
        model: selectedModel
      });

      const assistantMessage: ChatMessageUI = { role: 'assistant', content: assistantResponseContent };

      // 5. Save BOTH messages to DB using JS bindings
       console.log(`Saving interaction to DB for conversation ${currentConversationId}...`);
      try {
          await db.execute(
              "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3)",
              [currentConversationId, userMessage.role, userMessage.content]
          );
          await db.execute(
              "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3)",
              [currentConversationId, assistantMessage.role, assistantMessage.content]
          );
          console.log("Interaction saved to DB.");
      } catch (dbError: any) {
          console.error("Database insert error:", dbError);
          setError(prev => prev ? `${prev}\nDB Save Error: ${dbError?.message || dbError}` : `DB Save Error: ${dbError?.message || dbError}`);
           // Don't necessarily rollback UI on save failure, but log it.
      }

      // 6. Update UI state definitively with assistant response
      // Since we saved, we could reload, but adding is faster:
       setConversation(prev => [...prev, assistantMessage]); // Add assistant message


    } catch (err: any) {
      console.error("Error during handleSubmit:", err);
      setError(`Failed to get response: ${err?.message || err}`);
      // Rollback optimistic UI update by removing the last message (user's)
      setConversation(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  // --- Handle Model Selection (no DB interaction needed) ---
  const handleModelSelect = (modelName: string) => {
      setSelectedModel(modelName);
      setError("");
      console.log(`Model changed to ${modelName}.`);
  };

  // --- JSX ---
  return (
    // Use the specific class for chat layout from App.css
    <main className="container chat-container">
       {/* Model selector still useful */}
       <div className="model-selector-area">
           <label htmlFor="model-select">Model:</label>
           <select id="model-select" value={selectedModel} onChange={(e) => handleModelSelect(e.target.value)} disabled={listModels.length === 0 || isLoading || !db}>
               {listModels.length === 0 && <option value="" disabled>Loading...</option>}
               {listModels.map((model) => (
                   <option key={model.name} value={model.name}>{model.name}</option>
               ))}
           </select>
           <button onClick={getListModels} disabled={isLoading} title="Refresh Models List">🔄</button>
       </div>

       {/* Conversation History */}
       <div className="conversation-history">
           {conversation.map((msg, index) => (
               <div key={index} className={`message ${msg.role}`}>
                   <div className="message-content">
                       <pre>{msg.content}</pre>
                   </div>
               </div>
           ))}
           {isLoading && <div className="message assistant loading"><i>AI is thinking...</i></div>}
           <div ref={messagesEndRef} /> {/* For auto-scrolling */}
       </div>

       {/* Error Display */}
       {error && <p className="error-message">{error}</p>}

        {/* Prompt Input Form */}
       {/* Disable form if conversationId is invalid */}
       <form className="prompt-form" onSubmit={handleSubmit}>
           <input
               id="prompt-input"
               value={prompt}
               onChange={(e) => setPrompt(e.currentTarget.value)}
               placeholder={!currentConversationId || isNaN(currentConversationId) ? "Select a chat" : "Enter your prompt..."}
               disabled={isLoading || !selectedModel || !db || !currentConversationId || isNaN(currentConversationId)}
            />
           <button
               type="submit"
               disabled={isLoading || !prompt.trim() || !selectedModel || !db || !currentConversationId || isNaN(currentConversationId)}
               title="Send"
            >
               ▲
            </button>
       </form>
    </main>
  );
}

export default ChatPage;
