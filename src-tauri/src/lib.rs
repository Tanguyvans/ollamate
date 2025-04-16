use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage;
use ollama_rs::models::LocalModel;
use ollama_rs::Ollama;
use std::sync::Arc;
use tokio::sync::Mutex;

struct AppState {
    chat_history: Arc<Mutex<Vec<ChatMessage>>>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            chat_history: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[tauri::command]
async fn translate(text: String) -> String {
    return format!("Hello world {}", text);
}

#[tauri::command]
async fn ask_llm(
    prompt: String,
    model: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut ollama = Ollama::default();

    let mut history = state.chat_history.lock().await;

    println!(
        "Sending prompt for model '{}'. History length: {}",
        model,
        history.len()
    );

    let user_message = ChatMessage::user(prompt);

    let res = ollama
        .send_chat_messages_with_history(
            &mut *history,
            ChatMessageRequest::new(model, vec![user_message]),
        )
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
async fn get_ollama_models() -> Result<Vec<LocalModel>, String> {
    let ollama = Ollama::default();
    match ollama.list_local_models().await {
        Ok(models) => Ok(models),
        Err(e) => {
            eprintln!("Failed to list Ollama models: {}", e);
            Err(format!("Failed to list Ollama models: {}", e))
        }
    }
}

#[tauri::command]
async fn clear_chat_history(state: tauri::State<'_, AppState>) -> Result<(), String> {
    println!("Clearing chat history on backend.");
    let mut history = state.chat_history.lock().await;
    history.clear();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_ollama_models,
            ask_llm,
            translate,
            clear_chat_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
