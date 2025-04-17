import { Link } from 'react-router-dom'; // For navigation

function HomePage() {
  return (
    <div>
      <h1>Welcome Home!</h1>
      <p>This is the home page.</p>
      
      <Link to="/chat">Go to Chat</Link> {/* Example navigation link */}
    </div>
  );
}

export default HomePage; 