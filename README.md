# Ollamate 🧉

![Ollamate Logo](public/logo.png?raw=true)

A sleek, local desktop application built with Tauri and React to interact easily with your Ollama AI models. Ditch the terminal and manage your conversations in a user-friendly interface.

## Features ✨

- **Local First:** Runs entirely on your machine using Tauri.
- **Ollama Integration:** Seamlessly connect and chat with your locally running Ollama models.
- **Model Management:** View available local Ollama models and switch between them.
- **Conversation Management:**
  - Organize chats into separate, named conversations.
  - Persistent chat history stored locally in a SQLite database.
  - Create new chats and delete old ones.
- **Global Context:** Define a system prompt in the settings that applies to all conversations.
- **Modern Interface:** Clean UI built with React and styled with CSS.
- **Light/Dark Mode:** Adapts to your system's theme preference.

## Tech Stack ⚙️

- **Framework:** [Tauri](https://tauri.app/) (Rust backend, webview frontend)
- **Frontend:** [React](https://reactjs.org/) (with TypeScript)
- **Routing:** [React Router](https://reactrouter.com/)
- **Language Model Interface:** [Ollama](https://ollama.com/) via [ollama-rs](https://github.com/pepperoni21/ollama-rs) (Backend)
- **Database:** [SQLite](https://www.sqlite.org/index.html) via [tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace/tree/v1/plugins/sql) (Frontend Bindings)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Package Manager:** [Bun](https://bun.sh/) (or npm/yarn)

## Setup & Installation 🚀

**Prerequisites:**

- [Rust](https://www.rust-lang.org/tools/install) and Cargo
- Node.js and a package manager ([Bun](https://bun.sh/docs/installation), npm, or yarn)
- [Ollama](https://ollama.com/) installed and running locally with at least one model pulled (e.g., `ollama run llama3.2:1b`).
- Tauri prerequisites for your specific OS (see [Tauri prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites/)).

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```
2.  **Install frontend dependencies:**
    ```bash
    bun install
    # or npm install / yarn install
    ```
3.  **Install Rust dependencies (including Tauri plugins):**
    Tauri should handle this automatically when you run the dev or build command, but ensure the `sqlite` feature is enabled for `tauri-plugin-sql` in `src-tauri/Cargo.toml`.
4.  **(Optional) Generate App Icons:** Place your 1024x1024 app icon (e.g., `app-icon.png`) in `src-tauri/` and run:
    ```bash
    bun tauri icon src-tauri/app-icon.png
    ```
5.  **Run in development mode:**
    ```bash
    bun tauri dev
    ```
6.  **Build the application:**
    ```bash
    bun tauri build
    ```
    The executable will be in `src-tauri/target/release/`.

## Usage 📝

1.  Ensure Ollama is running locally.
2.  Launch the Ollamate application.
3.  The app will connect to your local Ollama instance to fetch available models.
4.  Select a model from the dropdown in the chat view.
5.  Use the sidebar to:
    - Navigate between Home, Chats, and Settings.
    - Click **"+ New Chat"** to create and name a new conversation thread.
    - Click on an existing chat name to load its history.
    - Hover over a chat name and click the '×' button to delete it.
6.  Go to **Settings** to modify the global system prompt used for all chats.
7.  Type your prompts in the input box at the bottom of the chat view and press Enter or click the Send button.

## Contributing 🤝

(Optional: Add details if you want others to contribute - e.g., contribution guidelines, code of conduct link).

## License 📄

(Optional: Specify the license, e.g., MIT License, Apache 2.0).

---

_Generated with assistance from an AI pair programmer._
