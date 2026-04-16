import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import '../App.css'

interface Circle {
    id: string;
    name: string;
}

interface PostMedia {
    id: string;
    blobUrl: string;
    mediaType: string;
    displayOrder: number;
}

interface Post {
    id: string;
    circleId: string;
    value: string;
    media: PostMedia[];
}

interface PendingFile {
    file: File;
    previewUrl: string;
    mediaType: 'image' | 'video';
}

export const Route = createFileRoute('/')({
    beforeLoad: ({ context }) => {
        if (!context.isAuthenticated) {
            throw redirect({ to: '/login' })
        }
    },
    component: HomePage,
})

function HomePage() {
    const { email, logout } = Route.useRouteContext()
    const [circles, setCircles] = useState<Circle[]>([])
    const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null)
    const [posts, setPosts] = useState<Post[]>([])
    const [error, setError] = useState<string | null>(null)
    const [newCircleName, setNewCircleName] = useState('')
    const [newPostValue, setNewPostValue] = useState('')
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [uploading, setUploading] = useState(false)
    const [lightboxItem, setLightboxItem] = useState<{ url: string; mediaType: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm']
    const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm']

    const fetchCircles = async () => {
        setError(null)
        try {
            const response = await fetch('/api/circles')
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const data: Circle[] = await response.json()
            setCircles(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch circles')
        }
    }

    const fetchPosts = async (circleId: string) => {
        try {
            const response = await fetch(`/api/posts/circle/${circleId}`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const data: Post[] = await response.json()
            setPosts(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch posts')
        }
    }

    const createCircle = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCircleName.trim()) return
        try {
            const response = await fetch('/api/circles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCircleName }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.errors?.[0] || 'Failed to create circle')
            }
            setNewCircleName('')
            await fetchCircles()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create circle')
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        const valid = files.filter(f => {
            const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
            return ALLOWED_EXTENSIONS.includes(ext)
        })
        const invalid = files.length - valid.length
        if (invalid > 0) setError(`${invalid} file(s) skipped — allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`)

        const newPending: PendingFile[] = valid.map(file => {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
            return {
                file,
                previewUrl: URL.createObjectURL(file),
                mediaType: VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'image',
            }
        })
        setPendingFiles(prev => [...prev, ...newPending])
        // Reset input so the same file can be re-selected if removed
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => {
            URL.revokeObjectURL(prev[index].previewUrl)
            return prev.filter((_, i) => i !== index)
        })
    }

    const uploadAllFiles = async (): Promise<{ blobUrl: string; mediaType: string; displayOrder: number }[]> => {
        return Promise.all(
            pendingFiles.map(async (pending, i) => {
                const res = await fetch(`/api/posts/media/upload-url?fileName=${encodeURIComponent(pending.file.name)}`)
                if (!res.ok) throw new Error('Failed to get upload URL')
                const { uploadUrl, blobUrl, mediaType } = await res.json()

                // PUT file bytes directly to Azure Blob Storage — server never touches the file content
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'x-ms-blob-type': 'BlockBlob',
                        'Content-Type': pending.file.type,
                    },
                    body: pending.file,
                })
                if (!uploadRes.ok) throw new Error(`Failed to upload ${pending.file.name}`)

                return { blobUrl, mediaType, displayOrder: i }
            })
        )
    }

    const createPost = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedCircle || !newPostValue.trim()) return
        setError(null)
        setUploading(true)
        try {
            const media = pendingFiles.length > 0 ? await uploadAllFiles() : []

            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ circleId: selectedCircle.id, value: newPostValue, media }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.errors?.[0] || 'Failed to create post')
            }
            setNewPostValue('')
            pendingFiles.forEach(p => URL.revokeObjectURL(p.previewUrl))
            setPendingFiles([])
            await fetchPosts(selectedCircle.id)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create post')
        } finally {
            setUploading(false)
        }
    }

    const selectCircle = (circle: Circle) => {
        setSelectedCircle(circle)
        setPosts([])
        fetchPosts(circle.id)
    }

    useEffect(() => {
        fetchCircles()
    }, [])

    // Close lightbox on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxItem(null) }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-bar">
                    <h1 className="app-brand">Circles</h1>
                    <div className="user-info">
                        <span className="user-email">{email}</span>
                        <button onClick={logout} className="logout-button">Sign Out</button>
                    </div>
                </div>
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

                            {circles.map((circle) => (
                                <button
                                    key={circle.id}
                                    onClick={() => selectCircle(circle)}
                                    className={`circle-item ${selectedCircle?.id === circle.id ? 'active' : ''}`}
                                >
                                    {circle.name}
                                </button>
                            ))}
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
                                        disabled={uploading}
                                    />

                                    {/* Pending file previews */}
                                    {pendingFiles.length > 0 && (
                                        <div className="pending-media-grid" role="list" aria-label="Files to attach">
                                            {pendingFiles.map((pf, i) => (
                                                <div key={i} className="pending-media-item" role="listitem">
                                                    {pf.mediaType === 'image'
                                                        ? <img src={pf.previewUrl} alt={pf.file.name} />
                                                        : <video src={pf.previewUrl} muted />
                                                    }
                                                    <button
                                                        type="button"
                                                        className="pending-media-remove"
                                                        onClick={() => removePendingFile(i)}
                                                        aria-label={`Remove ${pf.file.name}`}
                                                        disabled={uploading}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="post-form-actions">
                                        <button
                                            type="button"
                                            className="attach-button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            aria-label="Attach images or videos"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <path d="M21 15l-5-5L5 21" />
                                            </svg>
                                            {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''} attached` : 'Attach media'}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="visually-hidden"
                                            aria-hidden="true"
                                        />
                                        <button
                                            type="submit"
                                            className="primary-button"
                                            disabled={!newPostValue.trim() || uploading}
                                        >
                                            {uploading
                                                ? <><span className="btn-spinner" aria-hidden="true" />Uploading…</>
                                                : 'Post'
                                            }
                                        </button>
                                    </div>
                                </form>

                                <div className="posts-list">
                                    {posts.map((post) => (
                                        <article key={post.id} className="post-item">
                                            <p>{post.value}</p>
                                            {post.media && post.media.length > 0 && (
                                                <div
                                                    className={`post-media-grid post-media-grid--${Math.min(post.media.length, 4)}`}
                                                    role="list"
                                                    aria-label={`${post.media.length} media attachment${post.media.length > 1 ? 's' : ''}`}
                                                >
                                                    {post.media.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            className="post-media-item"
                                                            onClick={() => setLightboxItem({ url: m.blobUrl, mediaType: m.mediaType })}
                                                            aria-label={`View ${m.mediaType}`}
                                                            role="listitem"
                                                        >
                                                            {m.mediaType === 'image'
                                                                ? <img src={m.blobUrl} alt="" />
                                                                : (
                                                                    <div className="post-media-video-thumb">
                                                                        <video src={m.blobUrl} muted preload="metadata" />
                                                                        <span className="play-icon" aria-hidden="true">▶</span>
                                                                    </div>
                                                                )
                                                            }
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {/* Lightbox */}
            {lightboxItem && (
                <div
                    className="lightbox-overlay"
                    onClick={() => setLightboxItem(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Media viewer"
                >
                    <button className="lightbox-close" onClick={() => setLightboxItem(null)} aria-label="Close">✕</button>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        {lightboxItem.mediaType === 'image'
                            ? <img src={lightboxItem.url} alt="Full size media" />
                            : <video src={lightboxItem.url} controls autoPlay />
                        }
                    </div>
                </div>
            )}
        </div>
    )
}
