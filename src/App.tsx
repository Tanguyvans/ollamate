import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from '@tauri-apps/plugin-sql'; // Import Database
import "./App.css";

// Define DB Name
const DB_NAME = "sqlite:chat_history_persistent.db"; // Maybe use a different name for clarity

// Interface for Ollama Models (from backend)
interface LocalOllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

// Interface for messages (UI state and DB rows)
interface ChatMessageUI {
  // id?: number; // We don't need the ID in the UI state
  role: 'user' | 'assistant';
  content: string;
}

// Type for DB instance state
type DbInstance = Database | null;

function App() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [listModels, setListModels] = useState<LocalOllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [conversation, setConversation] = useState<ChatMessageUI[]>([]);
  const [db, setDb] = useState<DbInstance>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // --- Initialize DB and Load History ---
  useEffect(() => {
    const initializeDb = async () => {
      try {
        console.log("Loading database...");
        const loadedDb = await Database.load(DB_NAME);
        setDb(loadedDb); // Set DB instance in state
        console.log("Database loaded successfully.");

        await loadedDb.execute(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log("Table 'chat_messages' checked/created.");

        // Load existing history once DB is ready
        await loadHistoryFromDb(loadedDb);

        // Fetch models after DB is ready
        await getListModels(loadedDb, false); // Pass false to skip clearing history on initial load

      } catch (e) {
        console.error("Database initialization error:", e);
        setError(`Failed to initialize database: ${e}. Please restart the application.`);
        // Disable interactions if DB fails?
      }
    };
    initializeDb();

    // Optional cleanup: db?.close() when component unmounts?
    // Be cautious with async cleanup in React strict mode
  }, []); // Runs once on mount

  // --- Function to load history from DB ---
  const loadHistoryFromDb = async (database: Database | null = db) => {
      if (!database) {
          console.warn("DB not available to load history");
          setError("Cannot load history: Database not connected.");
          return;
      }
      try {
          console.log("Loading history from DB...");
          const loadedMessages: ChatMessageUI[] = await database.select(
              "SELECT role, content FROM chat_messages ORDER BY timestamp ASC"
          );
          setConversation(loadedMessages); // Update UI state
          console.log(`Loaded ${loadedMessages.length} messages from history.`);
      } catch (historyError) {
          console.error("Error loading history from DB:", historyError);
          setError(`Failed to load history: ${historyError}`);
      }
  };

  // --- Handle Sending Prompt ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentPrompt = prompt.trim();
    // Check DB connection along with other conditions
    if (!currentPrompt || !selectedModel || isLoading || !db) return;

    const userMessage: ChatMessageUI = { role: 'user', content: currentPrompt };

    // 1. Optimistically update UI state
    const messagesForBackend = [...conversation, userMessage]; // Prepare context for backend
    setConversation(messagesForBackend); // Update UI immediately
    setPrompt("");
    setIsLoading(true);
    setError("");

    try {
      // 2. Call Backend (backend is stateless regarding history)
      const assistantResponseContent: string = await invoke("ask_llm", {
        messages: messagesForBackend, // Send current history context
        model: selectedModel
      });

      const assistantMessage: ChatMessageUI = { role: 'assistant', content: assistantResponseContent };

      // 3. Update UI state with assistant response
      setConversation(prev => [...prev, assistantMessage]);

      // 4. Save BOTH messages to DB
      try {
          await db.execute(
              "INSERT INTO chat_messages (role, content) VALUES ($1, $2)",
              [userMessage.role, userMessage.content]
          );
          await db.execute(
              "INSERT INTO chat_messages (role, content) VALUES ($1, $2)",
              [assistantMessage.role, assistantMessage.content]
          );
          console.log("Interaction saved to DB.");
      } catch (dbError) {
          console.error("Database insert error:", dbError);
          setError(prev => prev ? `${prev}\nDB Save Error: ${dbError}` : `DB Save Error: ${dbError}`);
      }

    } catch (err) {
      console.error("Error invoking ask_llm:", err);
      setError(`Failed to get response: ${err}`);
      // Rollback optimistic UI update
      setConversation(conversation); // Revert to state before user message was added
    } finally {
      setIsLoading(false);
    }
  }

  // --- Fetch Models (WITHOUT Clearing DB) ---
  async function getListModels(database: Database | null = db, clearHistory = true) { // Added clearHistory flag
    if (!database && clearHistory) { // Only need DB if clearing
      console.warn("DB not available to clear history")
      // Can still proceed to fetch models if desired, or return
       // return;
    }

    setError("");
    setListModels([]); // Still clear model list state
    // Don't clear selectedModel here unless necessary (e.g., if it might become invalid)
    // Don't clear conversation state here

    // --- REMOVED: Database Clearing Logic ---
    if (clearHistory && database) {
        // try {
        //     console.log("Clearing chat_messages table...");
        //     await database.execute("DELETE FROM chat_messages");
        //     console.log("Database history cleared.");
        // } catch (clearErr) {
        //     console.error("Failed to clear database history:", clearErr);
        //     setError(`Failed to clear history DB: ${clearErr}`)
        // }
        console.log("Skipping history clearing during model refresh.");
    }
    // --- End Removed ---

    console.log("Attempting to invoke 'get_ollama_models'...");
    try {
      // Use correct expected type (assuming backend sends SerializableModel)
      const results: LocalOllamaModel[] = await invoke("get_ollama_models");
      console.log("Successfully invoked 'get_ollama_models'. Results:", results);
      setListModels(results);
      // Set default selection ONLY if no model is currently selected
      if (results.length > 0 && !selectedModel) {
        setSelectedModel(results[0].name);
      } else if (results.length > 0 && !results.some(m => m.name === selectedModel)){
        // If current selection is no longer valid, select the first one
        setSelectedModel(results[0].name);
      } else if (results.length === 0) {
          setSelectedModel(""); // No models available
      }
    } catch (err) {
      console.error("Error invoking 'get_ollama_models':", err);
      setError(`Failed to get models: ${err}`);
      setListModels([]);
      setSelectedModel("");
    }
  }

  // --- Handle Model Selection (WITHOUT Clearing DB) ---
  const handleModelSelect = async (modelName: string) => {
      // No need to check for DB here anymore
      setSelectedModel(modelName);
      // --- REMOVED: Clear Conversation State ---
      // setConversation([]);
      setError("");
      // --- REMOVED: Clear Database Logic ---
      // try {
      //   console.log("Clearing chat_messages table due to model change...");
      //   await db.execute("DELETE FROM chat_messages");
      //   console.log("Database history cleared.");
      // } catch (clearErr) {
      //     console.error("Failed to clear database history:", clearErr);
      //     setError(`Failed to clear history DB: ${clearErr}`);
      // }
      console.log(`Model changed to ${modelName}. History preserved.`);
  };

  // --- JSX (Mostly unchanged from previous chat version) ---
  return (
    <main className="container chat-container">
       <div className="model-selector-area">
           <label htmlFor="model-select">Model:</label>
           <select id="model-select" value={selectedModel} onChange={(e) => handleModelSelect(e.target.value)} disabled={listModels.length === 0 || isLoading || !db}>
               {listModels.length === 0 && <option value="" disabled>Loading...</option>}
               {listModels.map((model) => (
                   <option key={model.name} value={model.name}>{model.name}</option>
               ))}
           </select>
           {/* Button now just refreshes model list, doesn't clear history */}
           <button onClick={() => getListModels(db, false)} disabled={isLoading || !db} title="Refresh Models List">🔄</button>
       </div>

       <div className="conversation-history">
           {conversation.map((msg, index) => (
               <div key={index} className={`message ${msg.role}`}>
                   <div className="message-content"><pre>{msg.content}</pre></div>
               </div>
           ))}
           {isLoading && <div className="message assistant loading"><i>AI is thinking...</i></div>}
           <div ref={messagesEndRef} />
       </div>

       {error && <p className="error-message">{error}</p>}

       <form className="prompt-form" onSubmit={handleSubmit}>
           <input id="prompt-input" value={prompt} onChange={(e) => setPrompt(e.currentTarget.value)} placeholder="Enter your prompt..." disabled={isLoading || !selectedModel || !db} />
           <button type="submit" disabled={isLoading || !prompt.trim() || !selectedModel || !db}>Send</button>
       </form>
    </main>
  );
}

export default App;
