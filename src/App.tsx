import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface LocalOllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

// --- Interface for displayed messages ---
interface ChatMessageUI {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [listModels, setListModels] = useState<LocalOllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [conversation, setConversation] = useState<ChatMessageUI[]>([]);

  // Ref for scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- Auto-scroll effect ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]); // Scroll when conversation changes

  // --- Fetch models on initial mount ---
  useEffect(() => {
    getListModels();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentPrompt = prompt.trim(); // Capture prompt before clearing
    if (!currentPrompt || !selectedModel || isLoading) return;

    const userMessage: ChatMessageUI = { role: 'user', content: currentPrompt };

    // Update display state optimistically with user message
    setConversation(prev => [...prev, userMessage]);
    setPrompt(""); // Clear input
    setIsLoading(true);
    setError("");

    try {
      // --- Pass ONLY the new prompt and model to the backend ---
      // The backend now manages the actual history context
      const assistantResponseContent: string = await invoke("ask_llm", {
        prompt: currentPrompt, // Send only the new prompt string
        model: selectedModel
      });

      // Add assistant response to the DISPLAY state
      const assistantMessage: ChatMessageUI = { role: 'assistant', content: assistantResponseContent };
      setConversation(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error("Error invoking ask_llm:", err);
      setError(`Failed to get response: ${err}`);
      // Optional: Remove the optimistic user message on error
      // setConversation(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  async function getListModels() {
    setError("");
    setListModels([]);
    setSelectedModel("");
    // --- Also clear local conversation display when fetching models ---
    setConversation([]);
    // --- Call backend to clear its history state ---
    try {
        await invoke("clear_chat_history");
        console.log("Backend history cleared.");
    } catch (clearErr) {
        console.error("Failed to clear backend history:", clearErr);
        // Decide how to handle this - maybe show an error?
    }
    // --- End history clearing ---

    console.log("Attempting to invoke 'get_ollama_models'...");
    try {
      // Type the expected result correctly (Result pattern not shown here, adjust if using Result in Rust)
      const results: LocalOllamaModel[] = await invoke("get_ollama_models");
      console.log("Successfully invoked 'get_ollama_models'. Results:", results);
      setListModels(results);
      if (results.length > 0) {
        setSelectedModel(results[0].name);
      }
    } catch (err) {
      console.error("Error invoking 'get_ollama_models':", err);
      setError(`Failed to get models: ${err}`);
      setListModels([]);
      setSelectedModel("");
    }
  }

  const handleModelSelect = async (modelName: string) => {
    setSelectedModel(modelName);
    setConversation([]); // Clear local conversation display
    setError("");
     // --- Call backend to clear its history state when model changes ---
     try {
        await invoke("clear_chat_history");
        console.log("Backend history cleared due to model change.");
    } catch (clearErr) {
        console.error("Failed to clear backend history:", clearErr);
        setError(`Failed to clear backend history: ${clearErr}`);
    }
     // --- End history clearing ---
  };

  return (
    <main className="container chat-container"> {/* Add chat-container class */}
      <h1>Ollama Chat</h1>

      {/* --- Model Selection --- */}
      <div className="model-selector" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="model-select">Model:</label>
          <select /* ... dropdown setup remains the same ... */
            id="model-select"
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value)} // Use handler
            disabled={listModels.length === 0 || isLoading}
          >
            {listModels.length === 0 && <option value="" disabled>Loading...</option>}
            {listModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name} ({(model.size / 1_000_000_000).toFixed(2)} GB)
              </option>
            ))}
          </select>
           <button onClick={getListModels} disabled={isLoading} title="Refresh Models List">🔄</button>
      </div>

      {/* --- Conversation History Display (uses local state) --- */}
      <div className="conversation-history">
        {conversation.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <span className="role-indicator">{msg.role === 'user' ? 'You' : 'AI'}:</span>
            <div className="message-content">
                {/* Use pre for preserving formatting */}
                <pre>{msg.content}</pre>
            </div>
          </div>
        ))}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
       {/* Display loading indicator */}
       {isLoading && <div className="message assistant loading"><i>AI is thinking...</i></div>}

       {/* Error display */}
       {error && <p className="error-message">{error}</p>}

      {/* --- Prompt Input Form --- */}
      <form className="prompt-form" onSubmit={handleSubmit}>
        <input
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Enter your prompt..."
          disabled={isLoading || !selectedModel} // Disable if no model selected// Use textarea for potentially longer input
        />
        <button type="submit" disabled={isLoading || !prompt.trim() || !selectedModel}>
          Send
        </button>
      </form>

    </main>
  );
}

export default App;
