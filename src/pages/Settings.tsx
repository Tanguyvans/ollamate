import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';

function SettingsPage({ db }: { db: Database }) {
    const [context, setContext] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const GLOBAL_CONTEXT_KEY = "global_system_prompt";

    useEffect(() => {
        const fetchContext = async () => {
            setIsLoading(true);
            setError("");
            try {
                const result: Array<{ value: string }> = await db.select(
                    "SELECT value FROM settings WHERE key = $1",
                    [GLOBAL_CONTEXT_KEY]
                );
                if (result.length > 0) {
                    setContext(result[0].value);
                } else {
                    // If somehow it wasn't set by init, use default
                    setContext("You are a helpful assistant.");
                }
            } catch (e: any) {
                console.error("Error fetching context:", e);
                setError(`Failed to load context: ${e.message || e}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchContext();
    }, [db]); // Refetch if db instance changes (shouldn't normally)

    const handleSave = async () => {
        setError("");
        try {
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
                [GLOBAL_CONTEXT_KEY, context]
            );
            alert("Context saved!"); // Simple feedback
        } catch (e: any) {
            console.error("Error saving context:", e);
            setError(`Failed to save context: ${e.message || e}`);
        }
    };

    if (isLoading) return <div className="settings-page"><p>Loading settings...</p></div>;

    return (
        <div className="settings-page">
            <h1>Settings</h1>
            {error && <p className="error-message">{error}</p>}
            <div className="settings-form">
                <div>
                    <label htmlFor="global-context">Global System Prompt:</label>
                    <textarea
                        id="global-context"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        rows={10}
                    />
                    <button onClick={handleSave}>Save Context</button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;