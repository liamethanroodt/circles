import { useState, useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import type { AnyRouter } from '@tanstack/react-router';
import './App.css';

interface AppProps {
    router: AnyRouter;
}

function App({ router }: AppProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async (loggedInEmail?: string) => {
        if (loggedInEmail) {
            // Called after successful login — use the data directly
            setIsAuthenticated(true);
            setEmail(loggedInEmail);
            return;
        }

        // Called on page load — check cookie via /me
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            setIsAuthenticated(data.isAuthenticated ?? false);
            setEmail(data.email ?? null);
        } catch {
            setIsAuthenticated(false);
            setEmail(null);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore
        }
        setIsAuthenticated(false);
        setEmail(null);
    };

    // When auth state changes, invalidate the router so beforeLoad guards re-run
    useEffect(() => {
        router.invalidate();
    }, [isAuthenticated]);

    useEffect(() => {
        checkAuth();
    }, []);

    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="auth-spinner-page" />
            </div>
        );
    }

    return (
        <RouterProvider
            router={router}
            context={{ isAuthenticated, email, checkAuth, logout }}
        />
    );
}

export default App;
