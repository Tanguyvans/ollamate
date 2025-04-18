import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="home-page-container">
      <h1 className="home-title">Ollamate</h1>
      <p className="home-description">
        Interact easily with all your local models. Ditch the boring terminal
        and use this handy interface to explore, chat, and manage your conversations.
      </p>

      <div className="home-actions">
        <p>Get started:</p>
        <ul>
            <li>Use the sidebar to <strong>+ New Chat</strong> to start a conversation.</li>
            <li>Go to <Link to="/settings">Settings</Link> to configure the global system prompt.</li>
        </ul>
      </div>
    </div>
  );
}

export default HomePage; 