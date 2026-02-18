import { useState, useEffect } from 'react';
import './App.css';

interface Circle {
    id: string,
    name: string,
}

interface Post {
    id: string,
    circleId: string,
    value: string,
}

function App() {
    const [circles, setCircles] = useState<Circle[]>([]);
    const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newCircleName, setNewCircleName] = useState('');
    const [newPostValue, setNewPostValue] = useState('');

    const fetchCircles = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/circles');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: Circle[] = await response.json();
            setCircles(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch circles');
            console.error('Error fetching circles:', err);
        } finally {
            setLoading(false);
        }
    }

    const fetchPosts = async (circleId: string) => {
        try {
            const response = await fetch(`/api/posts/circle/${circleId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: Post[] = await response.json();
            setPosts(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch posts');
            console.error('Error fetching posts:', err);
        }
    }

    const createCircle = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newCircleName.trim()) return;

        try {
            const response = await fetch('/api/circles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCircleName })
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.errors?.[0] || 'Failed to create circle');
            }

            setNewCircleName('');
            await fetchCircles();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create circle');
            console.error('Error creating circle:', err);
        }
    }

    const createPost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCircle || !newPostValue.trim()) return;

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    circleId: selectedCircle.id,
                    value: newPostValue
                })
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.errors?.[0] || 'Failed to create post');
            }

            setNewPostValue('');
            await fetchPosts(selectedCircle.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create post');
            console.error('Error creating post:', err);
        }
    }

    const selectCircle = (circle: Circle) => {
        setSelectedCircle(circle);
        setPosts([]);
        fetchPosts(circle.id);
    }

    useEffect(() => {
        fetchCircles();
    }, []);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <a
                    href="https://aspire.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit Aspire website (opens in new tab)"
                    className="logo-link"
                >
                    {/*<img src={aspireLogo} className="logo" alt="Aspire logo" />*/}
                </a>
                <h1 className="app-title">Circles</h1>
                <p className="app-subtitle">Share your thoughts in circles</p>
            </header>

            <main className="main-content">
                {error && (
                    <div className="error-message" role="alert" aria-live="polite">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <div className="circles-container">
                    <section className="circles-section" aria-labelledby="circles-heading">
                        <div className="card">
                            <h2 id="circles-heading" className="section-title">Your Circles</h2>

                            <form onSubmit={createCircle} className="create-form">
                                <input
                                    type="text"
                                    value={newCircleName}
                                    onChange={(e) => setNewCircleName(e.target.value)}
                                    placeholder="New circle name..."
                                    className="text-input"
                                    maxLength={200}
                                />
                                <button type="submit" className="primary-button" disabled={!newCircleName.trim()}>
                                    Create Circle
                                </button>
                            </form>

                            {loading && circles.length === 0 ? (
                                <div className="loading-skeleton" role="status" aria-live="polite">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="skeleton-row" aria-hidden="true" />
                                    ))}
                                </div>
                            ) : (
                                <div className="circles-list">
                                    {circles.length === 0 ? (
                                        <p className="empty-state">No circles yet. Create one to get started!</p>
                                    ) : (
                                        circles.map((circle) => (
                                            <button
                                                key={circle.id}
                                                onClick={() => selectCircle(circle)}
                                                className={`circle-item ${selectedCircle?.id === circle.id ? 'active' : ''}`}
                                            >
                                                {circle.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {selectedCircle && (
                        <section className="posts-section" aria-labelledby="posts-heading">
                            <div className="card">
                                <h2 id="posts-heading" className="section-title">
                                    Posts in {selectedCircle.name}
                                </h2>

                                <form onSubmit={createPost} className="create-form">
                                    <textarea
                                        value={newPostValue}
                                        onChange={(e) => setNewPostValue(e.target.value)}
                                        placeholder="What's on your mind?"
                                        className="text-input"
                                        rows={3}
                                    />
                                    <button type="submit" className="primary-button" disabled={!newPostValue.trim()}>
                                        Create Post
                                    </button>
                                </form>

                                <div className="posts-list">
                                    {posts.length === 0 ? (
                                        <p className="empty-state">No posts yet. Be the first to post!</p>
                                    ) : (
                                        posts.map((post) => (
                                            <article key={post.id} className="post-item">
                                                <p>{post.value}</p>
                                            </article>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </main>

            <footer className="app-footer">
                <nav aria-label="Footer navigation">
                    <a href="https://aspire.dev" target="_blank" rel="noopener noreferrer">
                        Learn more about Aspire<span className="visually-hidden"> (opens in new tab)</span>
                    </a>
                    <a
                        href="https://github.com/dotnet/aspire"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="github-link"
                        aria-label="View Aspire on GitHub (opens in new tab)"
                    >
                        <img src="/github.svg" alt="" width="24" height="24" aria-hidden="true" />
                        <span className="visually-hidden">GitHub</span>
                    </a>
                </nav>
            </footer>
        </div>
    )
}

export default App
