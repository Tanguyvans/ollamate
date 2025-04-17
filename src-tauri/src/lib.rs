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
    let mut ollama = Ollama::default();
    println!(
        "Asking LLM (Rust backend) using function from docs for model '{}' with {} total messages received",
        model,
        messages.len()
    );

    // Map all incoming messages
    let all_chat_messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|msg| {
            let role = match msg.role.as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "system" => MessageRole::System,
                _ => MessageRole::User,
            };
            ChatMessage::new(role, msg.content)
        })
        .collect();

    // Separate history from the last message (the prompt)
    // Ensure there's at least one message to act as the prompt
    if all_chat_messages.is_empty() {
        return Err("No messages provided to LLM.".to_string());
    }

    // The last message is the new prompt for the request
    // We need to clone it as the request takes ownership
    let last_message = all_chat_messages.last().unwrap().clone();

    // The rest of the messages form the initial history
    // The library will mutate this history vector
    let mut history: Vec<ChatMessage> = all_chat_messages.into_iter().rev().skip(1).rev().collect(); // Efficiently get all but last

    println!(
        "Extracted history size: {}, Prompt: '{}'",
        history.len(),
        last_message.content
    );

    // Create the request with ONLY the last message
    let req = ChatMessageRequest::new(model.clone(), vec![last_message]);

    // Call the function from the docs example
    let res = ollama
        .send_chat_messages_with_history(&mut history, req)
        .await;

    // --- MODIFIED RESPONSE HANDLING (Direct Access matching Docs Example) ---
    match res {
        Ok(response) => {
            // Directly access .message.content as shown in the example
            // This assumes that if the overall Result is Ok, response.message is guaranteed to exist
            // and is NOT an Option based on compiler errors and the example.
            println!("Ollama responded successfully.");
            // Note: The example uses println!, we need to return Ok(content)
            Ok(response.message.content) // <-- Direct access
        }
        Err(e) => {
            eprintln!("Ollama API error: {}", e);
            Err(format!("Error communicating with Ollama: {}", e))
        }
    }
    // --- END MODIFIED RESPONSE HANDLING ---
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
