import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface LocalOllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [listModels, setListModels] = useState<LocalOllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    getListModels();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt || !selectedModel || isLoading) return;

    setIsLoading(true);
    setError("");
    setResponse("");

    try {
      const result: string = await invoke("ask_llm", {
        prompt: prompt,
        model: selectedModel
      });
      setResponse(result);

    } catch (err) {
      console.error("Error invoking ask_llm:", err);
      setError(`Failed to get response: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function getListModels() {
    setError("");
    setListModels([]);
    setSelectedModel("");
    console.log("Attempting to invoke 'get_ollama_models'...");

    try {
      const results: LocalOllamaModel[] = await invoke("get_ollama_models");
      console.log("Successfully invoked 'get_ollama_models'. Results:", results);
      setListModels(results);

      if (results.length > 0) {
        setSelectedModel(results[0].name);
        console.log("Set default model:", results[0].name);
      }

    } catch (err) {
      console.error("Error invoking 'get_ollama_models':", err);
      setError(`Failed to get models: ${err}`);
      setListModels([]);
      setSelectedModel("");
    }
  }

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
    console.log("Selected model:", modelName);
  };

  return (
    <main className="container">
      <h1>Welcome to our Ollama interface</h1>

      {selectedModel && <p>Selected Model: <strong>{selectedModel}</strong></p>}

      <div className="models-list" style={{ marginTop: '1rem', textAlign: 'left', maxWidth: '600px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3>Available Ollama Models:</h3>
          <button onClick={getListModels} disabled={isLoading} title="Refresh Models List">
            🔄 Refresh
          </button>
        </div>
        {listModels.length > 0 ? (
          <ul>
            {listModels.map((model) => {
              const isSelected = model.name === selectedModel;
              return (
                <li
                  key={model.name}
                  onClick={() => handleModelSelect(model.name)}
                  style={{
                    marginBottom: '0.25rem',
                    cursor: 'pointer',
                    padding: '0.25em 0.5em',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? '#646cff' : 'transparent',
                    color: isSelected ? 'white' : 'inherit',
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                >
                  {model.name} ({(model.size / 1_000_000_000).toFixed(2)} GB)
                </li>
              );
            })}
          </ul>
        ) : (
            <p><i>{isLoading ? "Loading models..." : "No models found or failed to load."}</i></p>
        )}
      </div>

      <h2>Ask the LLM</h2>

      <form className="row" onSubmit={handleSubmit}>
        <input
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Enter your prompt..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !prompt || !selectedModel}>
          {isLoading ? "Thinking..." : "Ask LLM"}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      {response && (
        <div className="response-area">
          <h3>Response:</h3>
          <pre className="response-pre">
            {response}
          </pre>
        </div>
      )}
    </main>
  );
}

export default App;
