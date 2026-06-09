// React
import { useState, useEffect, useRef } from "react";

// Components
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { ArrowLeft, Plus, X, LogOut, LayoutGrid, List, CircleDot, UserPlus } from "lucide-react";

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

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];

export const Route = createFileRoute("/circles/$circleName")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login", search: { confirmed: false } });
		}
	},
	component: CirclePostsPage,
});

function CirclePostsPage() {
	const { circleName } = Route.useParams();
	const navigate = useNavigate();
	const [circle, setCircle] = useState<Circle | null>(null);
	const [posts, setPosts] = useState<Post[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [newPostValue, setNewPostValue] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
	const [uploading, setUploading] = useState(false);
	const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [inviteSuccess, setInviteSuccess] = useState(false);
	const [inviting, setInviting] = useState(false);
	const [selectedPost, setSelectedPost] = useState<Post | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const fetchData = async () => {
		setError(null);
		try {
			const circlesRes = await fetch("/api/circles");
			if (!circlesRes.ok) throw new Error("Failed to load circles");
			const circles: Circle[] = await circlesRes.json();
			const found = circles.find((c) => c.name === circleName);
			if (!found) throw new Error("Circle not found");

			const postsRes = await fetch(`/api/posts/circle/${found.id}`);
			if (!postsRes.ok) throw new Error("Failed to load posts");
			const postsData: Post[] = await postsRes.json();

			setCircle(found);
			setPosts(postsData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		}
	};

	useEffect(() => {
		fetchData();
	}, [circleName]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		const valid = files.filter((f) => {
			const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
			return ALLOWED_EXTENSIONS.includes(ext);
		});
		const newPending: PendingFile[] = valid.map((file) => {
			const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
			return {
				file,
				previewUrl: URL.createObjectURL(file),
				mediaType: VIDEO_EXTENSIONS.includes(ext) ? "video" : "image",
			};
		});
		setPendingFiles((prev) => [...prev, ...newPending]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const removePendingFile = (index: number) => {
		setPendingFiles((prev) => {
			URL.revokeObjectURL(prev[index].previewUrl);
			return prev.filter((_, i) => i !== index);
		});
	};

	const uploadAllFiles = async () => {
		return Promise.all(
			pendingFiles.map(async (pending, i) => {
				const res = await fetch(`/api/posts/media/upload-url?fileName=${encodeURIComponent(pending.file.name)}`);
				if (!res.ok) throw new Error("Failed to get upload URL");
				const { uploadUrl, blobUrl, mediaType } = await res.json();
				const uploadRes = await fetch(uploadUrl, {
					method: "PUT",
					headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": pending.file.type },
					body: pending.file,
				});
				if (!uploadRes.ok) throw new Error(`Failed to upload ${pending.file.name}`);
				return { blobUrl, mediaType, displayOrder: i };
			}),
		);
	};

	const createPost = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!circle || !newPostValue.trim()) return;
		setError(null);
		setUploading(true);
		try {
			const media = pendingFiles.length > 0 ? await uploadAllFiles() : [];
			const res = await fetch("/api/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ circleId: circle.id, value: newPostValue, media }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.errors?.[0] || "Failed to create post");
			}
			setNewPostValue("");
			pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
			setPendingFiles([]);
			setShowForm(false);
			await fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create post");
		} finally {
			setUploading(false);
		}
	};

	const sendInvite = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!circle || !inviteEmail.trim()) return;
		setInviting(true);
		setInviteError(null);
		setInviteSuccess(false);
		try {
			const res = await fetch(`/api/circles/${circle.id}/invitations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ inviteeEmail: inviteEmail.trim() }),
			});
			const data = await res.json();
			if (!res.ok) {
				setInviteError(data.errors?.[0] ?? "Failed to send invitation.");
				return;
			}
			setInviteSuccess(true);
			setInviteEmail("");
		} finally {
			setInviting(false);
		}
	};

	const leaveCircle = async () => {
		if (!circle) return;
		setLeaving(true);
		try {
			const res = await fetch(`/api/circles/${circle.id}/leave`, { method: "DELETE" });
			if (!res.ok) throw new Error("Failed to leave circle");
			navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to leave circle");
			setLeaveDialogOpen(false);
		} finally {
			setLeaving(false);
		}
	};

	return (
		<div className="w-full min-h-screen flex flex-col">
			<Dialog
				open={inviteDialogOpen}
				onOpenChange={(open) => {
					setInviteDialogOpen(open);
					if (!open) {
						setInviteEmail("");
						setInviteError(null);
						setInviteSuccess(false);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite someone to "{circle?.name}"</DialogTitle>
						<DialogDescription>Enter their email address. They'll receive an invitation to join this circle.</DialogDescription>
					</DialogHeader>
					<form onSubmit={sendInvite} className="flex flex-col gap-4">
						<Input
							type="email"
							placeholder="Email address"
							value={inviteEmail}
							onChange={(e) => {
								setInviteEmail(e.target.value);
								setInviteError(null);
								setInviteSuccess(false);
							}}
							disabled={inviting}
							autoFocus
						/>
						{inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
						{inviteSuccess && <p className="text-sm text-green-600">Invitation sent!</p>}
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviting}>
								Close
							</Button>
							<Button type="submit" disabled={!inviteEmail.trim() || inviting}>
								{inviting ? "Sending…" : "Send invite"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Leave "{circle?.name}"?</DialogTitle>
						<DialogDescription>
							You'll no longer have access to this circle or its posts. If you're the only member, the circle will be deleted.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setLeaveDialogOpen(false)} disabled={leaving}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={leaveCircle} disabled={leaving}>
							{leaving ? "Leaving…" : "Leave circle"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<header className="px-4 pt-6 pb-4 border-b border-gray-200 sticky top-0 bg-white z-10">
				<div className="flex items-center gap-3 max-w-[600px] mx-auto">
					<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Back">
						<ArrowLeft className="size-5" />
					</Button>
					<h1 className="text-lg font-semibold m-0 flex-1">{circle?.name ?? "…"}</h1>
					<Button
						size="icon"
						variant="ghost"
						onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
						aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
					>
						{viewMode === "grid" ? <List className="size-5" /> : <LayoutGrid className="size-5" />}
					</Button>
					<Button size="icon" variant="ghost" onClick={() => setInviteDialogOpen(true)} aria-label="Invite someone">
						<UserPlus className="size-5" />
					</Button>
					<Button size="icon" variant="ghost" onClick={() => setLeaveDialogOpen(true)} aria-label="Leave circle">
						<LogOut className="size-5" />
					</Button>
					<Button size="icon" variant="ghost" onClick={() => setShowForm((v) => !v)} aria-label={showForm ? "Cancel" : "New post"}>
						{showForm ? <X className="size-5" /> : <Plus className="size-5" />}
					</Button>
				</div>
			</header>
			<main className="flex-1 max-w-[600px] w-full mx-auto px-4 py-6 flex flex-col gap-6">
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				{/* New post form */}
				{showForm && (
					<form onSubmit={createPost} className="flex flex-col gap-3 pb-4 border-b border-gray-200">
						<Textarea
							value={newPostValue}
							onChange={(e) => setNewPostValue(e.target.value)}
							placeholder="What's on your mind?"
							rows={3}
							disabled={uploading}
							className="resize-y"
							autoFocus
						/>
						{pendingFiles.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{pendingFiles.map((pf, i) => (
									<div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shrink-0">
										{pf.mediaType === "image" ? (
											<img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
										) : (
											<video src={pf.previewUrl} muted className="w-full h-full object-cover" />
										)}
										<Button
											type="button"
											variant="secondary"
											size="icon"
											onClick={() => removePendingFile(i)}
											disabled={uploading}
											className="absolute top-0.5 right-0.5 size-5 rounded-full text-[0.65rem]"
										>
											✕
										</Button>
									</div>
								))}
							</div>
						)}
						<div className="flex gap-2 items-center">
							<Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs">
								{pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}` : "Attach media"}
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
							<Button type="submit" size="sm" disabled={!newPostValue.trim() || uploading} className="ml-auto">
								{uploading ? "Posting…" : "Post"}
							</Button>
						</div>
					</form>
				)}
				{/* Post detail modal */}
				<Dialog
					open={!!selectedPost}
					onOpenChange={(open) => {
						if (!open) setSelectedPost(null);
					}}
				>
					<DialogContent className="max-w-lg p-0 overflow-hidden">
						<DialogHeader className="sr-only">
							<DialogTitle>Post</DialogTitle>
						</DialogHeader>
						{selectedPost &&
							(() => {
								const firstImage = selectedPost.media.find((m) => m.mediaType === "image");
								const firstVideo = selectedPost.media.find((m) => m.mediaType === "video");
								return (
									<>
										{firstImage && <img src={firstImage.blobUrl} alt="" className="w-full max-h-[60vh] object-contain bg-black" />}
										{firstVideo && <video src={firstVideo.blobUrl} controls className="w-full max-h-[60vh] bg-black" />}
										{selectedPost.value && (
											<div className="p-4">
												<p className="text-sm whitespace-pre-wrap">{selectedPost.value}</p>
											</div>
										)}
									</>
								);
							})()}
					</DialogContent>
				</Dialog>
				{/* Posts */}
				{posts.length === 0 && !showForm ? (
					<div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<CircleDot className="size-7" />
						</div>
						<div className="flex flex-col gap-1">
							<p className="font-medium">{circle?.name}</p>
							<p className="text-sm text-muted-foreground">No posts yet. Be the first to share something.</p>
						</div>
						<Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
							Create the first post
						</Button>
					</div>
				) : viewMode === "grid" ? (
					<div className="grid grid-cols-3 gap-[3px]">
						{posts.map((post) => {
							const firstImage = post.media.find((m) => m.mediaType === "image");
							const firstVideo = post.media.find((m) => m.mediaType === "video");
							return (
								<div key={post.id} className="relative aspect-square bg-gray-100 overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
									{firstImage ? (
										<img src={firstImage.blobUrl} alt="" className="w-full h-full object-cover" />
									) : firstVideo ? (
										<video src={firstVideo.blobUrl} muted className="w-full h-full object-cover" />
									) : (
										<div className="w-full h-full flex items-center justify-center p-3">
											<p className="text-xs text-gray-600 text-center line-clamp-4 leading-relaxed">{post.value}</p>
										</div>
									)}
									{post.media.length > 1 && (
										<div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-white text-[10px] leading-none">
											1/{post.media.length}
										</div>
									)}
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col divide-y divide-gray-100">
						{posts.map((post) => {
							const firstImage = post.media.find((m) => m.mediaType === "image");
							const firstVideo = post.media.find((m) => m.mediaType === "video");
							return (
								<div key={post.id} className="flex flex-col py-4 gap-3">
									{firstImage && <img src={firstImage.blobUrl} alt="" className="w-full rounded-lg object-cover max-h-[480px]" />}
									{firstVideo && <video src={firstVideo.blobUrl} controls className="w-full rounded-lg max-h-[480px] bg-black" />}
									{post.value && <p className="text-sm whitespace-pre-wrap">{post.value}</p>}
								</div>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
