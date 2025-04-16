use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage;
use ollama_rs::models::LocalModel;
use ollama_rs::Ollama;

#[tauri::command]
async fn translate(text: String) -> String {
    return format!("Hello world {}", text);
}

#[tauri::command]
async fn ask_llm(prompt: String, model: String) -> String {
    let mut ollama = Ollama::default();
    let mut history = vec![];

    let res = ollama
        .send_chat_messages_with_history(
            &mut history, // <- messages will be saved here
            ChatMessageRequest::new(
                model,
                vec![ChatMessage::user(prompt)], // <- You should provide only one message
            ),
        )
        .await;

    if let Ok(res) = res {
        return res.message.content;
    } else {
        return "No Value".to_string();
    }
}

#[tauri::command]
async fn get_ollama_models() -> Vec<LocalModel> {
    let ollama = Ollama::default();
    return ollama.list_local_models().await.unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_ollama_models,
            ask_llm,
            translate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
