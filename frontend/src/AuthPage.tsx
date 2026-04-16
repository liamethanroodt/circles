import { useState } from 'react';
import './AuthPage.css';

interface AuthPageProps {
    onAuthenticated: (email: string) => void;
}

function AuthPage({ onAuthenticated }: AuthPageProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.errors?.[0] || 'Something went wrong.');
            }

            if (isLogin) {
                onAuthenticated(email);
            } else {
                // Registration successful — switch to Sign In with credentials prepopulated
                setIsLogin(true);
                setSuccess('Account created! Sign in with your credentials.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-title">Circles</h1>
                    <p className="auth-subtitle">Share your thoughts in circles</p>
                </div>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
                    >
                        Sign In
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
                    >
                        Create Account
                    </button>
                </div>

                {success && (
                    <div className="auth-success" role="status">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                {error && (
                    <div className="auth-error" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="form-input"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="form-input"
                            required
                            minLength={6}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={loading || !email.trim() || !password.trim()}
                    >
                        {loading ? (
                            <span className="auth-spinner" />
                        ) : (
                            isLogin ? 'Sign In' : 'Create Account'
                        )}
                    </button>
                </form>

                {!isLogin && (
                    <p className="auth-hint">
                        Password must be at least 6 characters with an uppercase letter and a digit.
                    </p>
                )}
            </div>
        </div>
    );
}

export default AuthPage;
