// React
import { useState, useEffect, useRef } from "react";

// Components`
import { ConcentricRings } from "@/components/ConcentricRings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Routing
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

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
	mediaType: "image" | "video";
}

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login" });
		}
	},
	component: HomePage,
});

function HomePage() {
	const { email, logout } = Route.useRouteContext();
	const navigate = useNavigate();
	const [circles, setCircles] = useState<Circle[]>([]);
	const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
	const [posts, setPosts] = useState<Post[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [newCircleName, setNewCircleName] = useState("");
	const [newPostValue, setNewPostValue] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
	const [uploading, setUploading] = useState(false);
	const [lightboxItem, setLightboxItem] = useState<{ url: string; mediaType: string } | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
	const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];

	const fetchCircles = async () => {
		setError(null);
		try {
			const response = await fetch("/api/circles");
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data: Circle[] = await response.json();
			setCircles(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch circles");
		}
	};

	const fetchPosts = async (circleId: string) => {
		try {
			const response = await fetch(`/api/posts/circle/${circleId}`);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data: Post[] = await response.json();
			setPosts(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch posts");
		}
	};

	const createCircle = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newCircleName.trim()) return;
		try {
			const response = await fetch("/api/circles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newCircleName }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.errors?.[0] || "Failed to create circle");
			}
			setNewCircleName("");
			await fetchCircles();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create circle");
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		const valid = files.filter((f) => {
			const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
			return ALLOWED_EXTENSIONS.includes(ext);
		});
		const invalid = files.length - valid.length;
		if (invalid > 0) setError(`${invalid} file(s) skipped — allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`);

		const newPending: PendingFile[] = valid.map((file) => {
			const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
			return {
				file,
				previewUrl: URL.createObjectURL(file),
				mediaType: VIDEO_EXTENSIONS.includes(ext) ? "video" : "image",
			};
		});
		setPendingFiles((prev) => [...prev, ...newPending]);
		// Reset input so the same file can be re-selected if removed
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const removePendingFile = (index: number) => {
		setPendingFiles((prev) => {
			URL.revokeObjectURL(prev[index].previewUrl);
			return prev.filter((_, i) => i !== index);
		});
	};

	const uploadAllFiles = async (): Promise<{ blobUrl: string; mediaType: string; displayOrder: number }[]> => {
		return Promise.all(
			pendingFiles.map(async (pending, i) => {
				const res = await fetch(`/api/posts/media/upload-url?fileName=${encodeURIComponent(pending.file.name)}`);
				if (!res.ok) throw new Error("Failed to get upload URL");
				const { uploadUrl, blobUrl, mediaType } = await res.json();

				// PUT file bytes directly to Azure Blob Storage — server never touches the file content
				const uploadRes = await fetch(uploadUrl, {
					method: "PUT",
					headers: {
						"x-ms-blob-type": "BlockBlob",
						"Content-Type": pending.file.type,
					},
					body: pending.file,
				});
				if (!uploadRes.ok) throw new Error(`Failed to upload ${pending.file.name}`);

				return { blobUrl, mediaType, displayOrder: i };
			}),
		);
	};

	const createPost = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCircle || !newPostValue.trim()) return;
		setError(null);
		setUploading(true);
		try {
			const media = pendingFiles.length > 0 ? await uploadAllFiles() : [];

			const response = await fetch("/api/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ circleId: selectedCircle.id, value: newPostValue, media }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.errors?.[0] || "Failed to create post");
			}
			setNewPostValue("");
			pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
			setPendingFiles([]);
			await fetchPosts(selectedCircle.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create post");
		} finally {
			setUploading(false);
		}
	};

	const selectCircle = (circle: Circle) => {
		setSelectedCircle(circle);
		setPosts([]);
		fetchPosts(circle.id);
	};

	useEffect(() => {
		fetchCircles();
	}, []);

	// Close lightbox on Escape key
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setLightboxItem(null);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	return (
		<div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white">
			<header className="px-8 pt-10 pb-6">
				<div className="flex justify-between items-center max-w-[1400px] w-full mx-auto">
					<h1 className="text-2xl font-bold bg-gradient-to-br from-[#7c92f5] to-[#8b5ecf] bg-clip-text text-transparent m-0">Circles</h1>
					<div className="flex items-center gap-4">
						<span className="text-sm text-slate-400 font-medium">{email}</span>
						<Button
							variant="outline"
							size="sm"
							onClick={logout}
							className="border-white/10 bg-white/[0.08] text-slate-300 hover:bg-red-500/15 hover:border-red-500 hover:text-red-400"
						>
							Sign Out
						</Button>
					</div>
				</div>
			</header>

			<button onClick={() => navigate({ to: "/profile", viewTransition: true })}>test</button>
			<ConcentricRings>
				<div
					style={
						{
							backgroundColor: "red",
							borderRadius: 999,
							width: 75,
							height: 75,
							viewTransitionName: "red-circle",
						} as React.CSSProperties
					}
				/>
			</ConcentricRings>

			<main className="flex-1 max-w-[1400px] w-full mx-auto px-8 pb-8">
				{error && (
					<Alert variant="destructive" aria-live="polite" className="my-4">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className="grid grid-cols-2 gap-6 w-full max-lg:grid-cols-1">
					<section aria-labelledby="circles-heading">
						<Card className="bg-[rgba(30,30,46,0.95)] border-white/10 text-white backdrop-blur-sm">
							<CardHeader>
								<CardTitle id="circles-heading" className="text-xl">
									Your Circles
								</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<form onSubmit={createCircle} className="flex flex-col gap-3">
									<Input
										type="text"
										value={newCircleName}
										onChange={(e) => setNewCircleName(e.target.value)}
										placeholder="New circle name..."
										maxLength={200}
										className="bg-[rgba(45,45,60,0.8)] border-white/10 text-white placeholder:text-slate-500"
									/>
									<Button
										type="submit"
										disabled={!newCircleName.trim()}
										className="bg-gradient-to-br from-[#7c92f5] to-[#8b5ecf] border-0 text-white font-semibold"
									>
										Create Circle
									</Button>
								</form>

								<div className="flex flex-col gap-2">
									{circles.map((circle) => (
										<button
											key={circle.id}
											onClick={() => selectCircle(circle)}
											className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-all border cursor-pointer ${
												selectedCircle?.id === circle.id
													? "bg-gradient-to-br from-[#7c92f5] to-[#8b5ecf] border-transparent text-white"
													: "bg-[rgba(45,45,60,0.8)] border-white/10 text-white hover:bg-[rgba(124,146,245,0.1)] hover:border-[#7c92f5] hover:translate-x-1"
											}`}
										>
											{circle.name}
										</button>
									))}
								</div>
							</CardContent>
						</Card>
					</section>

					{selectedCircle && (
						<section aria-labelledby="posts-heading">
							<Card className="bg-[rgba(30,30,46,0.95)] border-white/10 text-white backdrop-blur-sm">
								<CardHeader>
									<CardTitle id="posts-heading" className="text-xl">
										Posts in {selectedCircle.name}
									</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-col gap-4">
									<form onSubmit={createPost} className="flex flex-col gap-3">
										<Textarea
											value={newPostValue}
											onChange={(e) => setNewPostValue(e.target.value)}
											placeholder="What's on your mind?"
											rows={3}
											disabled={uploading}
											className="bg-[rgba(45,45,60,0.8)] border-white/10 text-white placeholder:text-slate-500 resize-y"
										/>

										{/* Pending file previews */}
										{pendingFiles.length > 0 && (
											<div className="flex flex-wrap gap-2" role="list" aria-label="Files to attach">
												{pendingFiles.map((pf, i) => (
													<div
														key={i}
														className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 shrink-0"
														role="listitem"
													>
														{pf.mediaType === "image" ? (
															<img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover block" />
														) : (
															<video src={pf.previewUrl} muted className="w-full h-full object-cover block" />
														)}
														<button
															type="button"
															onClick={() => removePendingFile(i)}
															aria-label={`Remove ${pf.file.name}`}
															disabled={uploading}
															className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white border-none text-[0.65rem] cursor-pointer flex items-center justify-center hover:bg-red-500/90 transition-colors"
														>
															✕
														</button>
													</div>
												))}
											</div>
										)}

										<div className="flex gap-3 items-center">
											<Button
												type="button"
												variant="outline"
												onClick={() => fileInputRef.current?.click()}
												disabled={uploading}
												aria-label="Attach images or videos"
												className="flex items-center gap-2 border-white/10 bg-[rgba(45,45,60,0.8)] text-slate-300 hover:border-[#7c92f5] hover:text-white shrink-0 text-xs font-semibold"
											>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
													<rect x="3" y="3" width="18" height="18" rx="2" />
													<circle cx="8.5" cy="8.5" r="1.5" />
													<path d="M21 15l-5-5L5 21" />
												</svg>
												{pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} attached` : "Attach media"}
											</Button>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
												multiple
												onChange={handleFileSelect}
												className="sr-only"
												aria-hidden="true"
											/>
											<Button
												type="submit"
												disabled={!newPostValue.trim() || uploading}
												className="bg-gradient-to-br from-[#7c92f5] to-[#8b5ecf] border-0 text-white font-semibold flex items-center gap-2"
											>
												{uploading ? (
													<>
														<span
															className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
															aria-hidden="true"
														/>
														Uploading…
													</>
												) : (
													"Post"
												)}
											</Button>
										</div>
									</form>

									<div className="flex flex-col gap-2">
										{posts.map((post) => (
											<article key={post.id} className="p-4 bg-[rgba(45,45,60,0.8)] border border-white/10 rounded-lg">
												<p className="m-0 text-slate-300 leading-relaxed break-words">{post.value}</p>
												{post.media && post.media.length > 0 && (
													<div
														className={`grid gap-[3px] mt-3 rounded-lg overflow-hidden ${
															post.media.length === 1
																? "grid-cols-1 max-h-[400px]"
																: post.media.length === 2
																	? "grid-cols-2 max-h-[240px]"
																	: "grid-cols-2 [grid-template-rows:160px_160px] max-h-[323px]"
														}`}
														role="list"
														aria-label={`${post.media.length} media attachment${post.media.length > 1 ? "s" : ""}`}
													>
														{post.media.map((m, idx) => (
															<button
																key={m.id}
																onClick={() => setLightboxItem({ url: m.blobUrl, mediaType: m.mediaType })}
																aria-label={`View ${m.mediaType}`}
																role="listitem"
																className={`block w-full h-full overflow-hidden cursor-pointer border-none p-0 relative min-h-[120px] bg-[rgba(45,45,60,0.8)] group ${
																	post.media.length === 3 && idx === 0 ? "row-span-2" : ""
																}`}
															>
																{m.mediaType === "image" ? (
																	<img
																		src={m.blobUrl}
																		alt=""
																		className="w-full h-full object-cover block group-hover:scale-[1.04] transition-transform"
																	/>
																) : (
																	<div className="relative w-full h-full">
																		<video src={m.blobUrl} muted preload="metadata" className="w-full h-full object-cover block" />
																		<span
																			className="absolute inset-0 flex items-center justify-center text-[1.75rem] text-white bg-black/35 group-hover:bg-black/50 transition-colors pointer-events-none"
																			aria-hidden="true"
																		>
																			▶
																		</span>
																	</div>
																)}
															</button>
														))}
													</div>
												)}
											</article>
										))}
									</div>
								</CardContent>
							</Card>
						</section>
					)}
				</div>
			</main>

			{/* Lightbox */}
			{lightboxItem && (
				<div
					className="fixed inset-0 bg-black/90 flex items-center justify-center z-[1000] p-4"
					onClick={() => setLightboxItem(null)}
					role="dialog"
					aria-modal="true"
					aria-label="Media viewer"
				>
					<button
						className="fixed top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white border border-white/20 text-base cursor-pointer flex items-center justify-center z-[1001] hover:bg-white/25 transition-colors"
						onClick={() => setLightboxItem(null)}
						aria-label="Close"
					>
						✕
					</button>
					<div
						className="max-w-[min(90vw,1200px)] max-h-[90vh] flex items-center justify-center [&_img]:max-w-full [&_img]:max-h-[90vh] [&_img]:rounded-lg [&_img]:object-contain [&_img]:shadow-2xl [&_video]:max-w-full [&_video]:max-h-[90vh] [&_video]:rounded-lg"
						onClick={(e) => e.stopPropagation()}
					>
						{lightboxItem.mediaType === "image" ? <img src={lightboxItem.url} alt="Full size media" /> : <video src={lightboxItem.url} controls autoPlay />}
					</div>
				</div>
			)}
		</div>
	);
}
