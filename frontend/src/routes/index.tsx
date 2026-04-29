// React
import { useState, useEffect, useRef } from "react";

// Components
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConcentricRings } from "@/components/ConcentricRings";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { UserRound } from "lucide-react";

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
	const navigate = useNavigate();
	const [circles, setCircles] = useState<Circle[]>([]);
	const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
	const [posts, setPosts] = useState<Post[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [newCircleName, setNewCircleName] = useState("");
	const [newPostValue, setNewPostValue] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
	const [uploading, setUploading] = useState(false);
	const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
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
		fetch("/api/auth/me")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data?.profilePictureUrl) setProfilePictureUrl(data.profilePictureUrl);
			})
			.catch(() => {});
	}, []);

	return (
		<div className="w-full min-h-screen flex flex-col">
			<header className="px-8 pt-10 pb-6 border-b border-gray-200">
				<div className="flex justify-between items-center max-w-[1400px] w-full mx-auto">
					<h1 className="text-2xl font-bold m-0">Circles</h1>
				</div>
			</header>
			<div className="flex justify-center m-10">
				<ConcentricRings>
					<Avatar size="lg" className="size-[75px] cursor-pointer" onClick={() => navigate({ to: "/profile", viewTransition: true })}>
						<AvatarImage src={profilePictureUrl ?? undefined} />
						<AvatarFallback>
							<UserRound className="size-8" />
						</AvatarFallback>
					</Avatar>
				</ConcentricRings>
			</div>
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
						<Card>
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
									/>
									<Button type="submit" disabled={!newCircleName.trim()}>
										Create Circle
									</Button>
								</form>
								<div className="flex flex-col gap-2">
									{circles.map((circle) => (
										<Button
											key={circle.id}
											variant={selectedCircle?.id === circle.id ? "default" : "outline"}
											className="w-full justify-start"
											onClick={() => selectCircle(circle)}
										>
											{circle.name}
										</Button>
									))}
								</div>
							</CardContent>
						</Card>
					</section>
					{selectedCircle && (
						<section aria-labelledby="posts-heading">
							<Card>
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
											className="resize-y"
										/>
										{/* Pending file previews */}
										{pendingFiles.length > 0 && (
											<div className="flex flex-wrap gap-2" role="list" aria-label="Files to attach">
												{pendingFiles.map((pf, i) => (
													<div
														key={i}
														className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shrink-0"
														role="listitem"
													>
														{pf.mediaType === "image" ? (
															<img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover block" />
														) : (
															<video src={pf.previewUrl} muted className="w-full h-full object-cover block" />
														)}
														<Button
															type="button"
															variant="secondary"
															size="icon"
															onClick={() => removePendingFile(i)}
															aria-label={`Remove ${pf.file.name}`}
															disabled={uploading}
															className="absolute top-0.5 right-0.5 size-5 rounded-full text-[0.65rem]"
														>
															✕
														</Button>
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
												className="flex items-center gap-2 shrink-0 text-xs font-semibold"
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
											<Button type="submit" disabled={!newPostValue.trim() || uploading} className="flex items-center gap-2">
												{uploading ? (
													<>
														<span
															className="inline-block w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin"
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
											<article key={post.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
												<p className="m-0 text-gray-700 leading-relaxed break-words">{post.value}</p>
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
																aria-label={`View ${m.mediaType}`}
																role="listitem"
																className={`block w-full h-full overflow-hidden cursor-pointer border-none p-0 relative min-h-[120px] bg-gray-100 group ${
																	post.media.length === 3 && idx === 0 ? "row-span-2" : ""
																}`}
															>
																{m.mediaType === "image" && (
																	<img
																		src={m.blobUrl}
																		alt=""
																		className="w-full h-full object-cover block group-hover:scale-[1.04] transition-transform"
																	/>
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
		</div>
	);
}
