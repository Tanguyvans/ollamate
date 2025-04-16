use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::{ChatMessage, MessageRole};
use ollama_rs::Ollama;
use serde::{Deserialize, Serialize};

// --- Struct matching the frontend's ChatMessageUI ---
// Used to receive messages from the frontend
#[derive(Deserialize, Debug)]
struct FrontendMessage {
    role: String,
    content: String,
}

// Optional wrapper for LocalModel if it doesn't derive Serialize
#[derive(Serialize, Clone, Debug)]
struct SerializableModel {
    name: String,
    modified_at: String,
    size: u64,
}

#[tauri::command]
async fn ask_llm(messages: Vec<FrontendMessage>, model: String) -> Result<String, String> {
    let ollama = Ollama::default();

    println!("Received {} messages for model '{}'", messages.len(), model);

    // Map frontend messages to ollama_rs::ChatMessage
    let chat_messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|msg| {
            let role = match msg.role.as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            };
            ChatMessage::new(role, msg.content)
        })
        .collect();

    if chat_messages.is_empty() {
        return Err("No messages provided to LLM.".to_string());
    }

    // Use send_chat_messages (stateless regarding history)
    let res = ollama
        .send_chat_messages(ChatMessageRequest::new(model, chat_messages))
        .await;

    match res {
        Ok(res) => {
            println!("Ollama responded successfully.");
            Ok(res.message.content)
        }
        Err(e) => {
            eprintln!("Ollama API error: {}", e);
            Err(format!("Error communicating with Ollama: {}", e))
        }
    }
}

#[tauri::command]
async fn get_ollama_models() -> Result<Vec<SerializableModel>, String> {
    let ollama = Ollama::default();
    match ollama.list_local_models().await {
        Ok(models) => {
            // Map to serializable struct
            let serializable_models = models
                .into_iter()
                .map(|m| SerializableModel {
                    name: m.name,
                    modified_at: m.modified_at,
                    size: m.size,
                })
                .collect();
            Ok(serializable_models)
        }
        Err(e) => {
            eprintln!("Failed to list Ollama models: {}", e);
            Err(format!("Failed to list Ollama models: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_ollama_models, ask_llm])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
