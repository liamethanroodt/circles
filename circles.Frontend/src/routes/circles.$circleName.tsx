// React
import { useState, useEffect, useRef } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Icons
import { ArrowLeft, Plus, X, LogOut, LayoutGrid, List, CircleDot, UserPlus } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

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
	authorId: string;
	authorDisplayName: string;
	authorProfilePictureUrl: string | null;
	createdAt: string;
	media: PostMedia[];
}

interface PendingFile {
	file: File;
	previewUrl: string;
	mediaType: "image" | "video";
}

interface Friend {
	userId: string;
	displayName: string;
	profilePictureUrl: string | null;
}

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];

function PostCard({ post }: { post: Post }) {
	const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
	const [currentSlide, setCurrentSlide] = useState(0);

	useEffect(() => {
		if (!carouselApi) return;
		const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
		carouselApi.on("select", onSelect);
		return () => {
			carouselApi.off("select", onSelect);
		};
	}, [carouselApi]);

	return (
		<Card className="overflow-hidden pt-0 pb-1">
			<div className="flex items-center gap-2.5 px-3 py-2.5 border-b">
				<Avatar className="size-7 shrink-0">
					<AvatarImage src={post.authorProfilePictureUrl ?? undefined} />
					<AvatarFallback className="text-xs">{post.authorDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
				</Avatar>
				<span className="text-sm font-medium flex-1 truncate">{post.authorDisplayName}</span>
				<span className="text-xs text-muted-foreground shrink-0">
					{new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
				</span>
			</div>
			{post.media.length > 0 && (
				<div className="relative bg-black">
					<Carousel setApi={setCarouselApi}>
						<CarouselContent className="ml-0">
							{post.media.map((m) => (
								<CarouselItem key={m.id} className="pl-0">
									{m.mediaType === "image" ? (
										<img src={m.blobUrl} alt="" className="w-full max-h-[480px] object-contain" />
									) : (
										<video src={m.blobUrl} controls className="w-full max-h-[480px]" />
									)}
								</CarouselItem>
							))}
						</CarouselContent>
						{post.media.length > 1 && (
							<>
								<CarouselPrevious className="left-2 size-7 bg-black/50 border-0 text-white hover:bg-black/70 hover:text-white" />
								<CarouselNext className="right-2 size-7 bg-black/50 border-0 text-white hover:bg-black/70 hover:text-white" />
							</>
						)}
					</Carousel>
					{post.media.length > 1 && (
						<div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
							{post.media.map((_, i) => (
								<div key={i} className={cn("size-1.5 rounded-full transition-colors", i === currentSlide ? "bg-white" : "bg-white/40")} />
							))}
						</div>
					)}
				</div>
			)}
			{post.value && (
				<div className="px-3 py-2">
					<p className="text-sm whitespace-pre-wrap">
						<span className="font-semibold">{post.authorDisplayName}</span>: {post.value}
					</p>
				</div>
			)}
		</Card>
	);
}

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
	const [showForm, setShowForm] = useState(false);
	const [newPostValue, setNewPostValue] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
	const [uploading, setUploading] = useState(false);
	const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const [viewMode, setViewMode] = useState<"grid" | "list">("list");
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [loadingFriends, setLoadingFriends] = useState(false);
	const [inviteStatuses, setInviteStatuses] = useState<Record<string, string>>({});
	const [selectedPost, setSelectedPost] = useState<Post | null>(null);
	const [postCarouselApi, setPostCarouselApi] = useState<CarouselApi | null>(null);
	const [currentSlide, setCurrentSlide] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const fetchData = async () => {
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
			toast.error(err instanceof Error ? err.message : "Couldn't load posts");
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
			toast.success("Posted");
			await fetchData();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Couldn't post");
		} finally {
			setUploading(false);
		}
	};

	useEffect(() => {
		if (!postCarouselApi) return;
		const onSelect = () => setCurrentSlide(postCarouselApi.selectedScrollSnap());
		postCarouselApi.on("select", onSelect);
		return () => {
			postCarouselApi.off("select", onSelect);
		};
	}, [postCarouselApi]);

	useEffect(() => {
		setCurrentSlide(0);
	}, [selectedPost]);

	useEffect(() => {
		if (!inviteDialogOpen) return;
		setLoadingFriends(true);
		setInviteStatuses({});
		fetch("/api/friends/")
			.then((r) => (r.ok ? r.json() : []))
			.then(setFriends)
			.catch(() => setFriends([]))
			.finally(() => setLoadingFriends(false));
	}, [inviteDialogOpen]);

	const sendInvite = async (friendId: string) => {
		if (!circle) return;
		setInviteStatuses((prev) => ({ ...prev, [friendId]: "sending" }));
		try {
			const res = await fetch(`/api/circles/${circle.id}/invitations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ inviteeId: friendId }),
			});
			const data = await res.json();
			setInviteStatuses((prev) => ({
				...prev,
				[friendId]: res.ok ? "sent" : (data.errors?.[0] ?? "Failed to send invitation."),
			}));
		} catch {
			setInviteStatuses((prev) => ({ ...prev, [friendId]: "Failed to send invitation." }));
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
			toast.error(err instanceof Error ? err.message : "Couldn't leave circle");
			setLeaveDialogOpen(false);
		} finally {
			setLeaving(false);
		}
	};

	return (
		<div className="w-full min-h-screen flex flex-col relative">
			<FloatingBackground />
			{/* Invite dialog */}
			<Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite to "{circle?.name}"</DialogTitle>
						<DialogDescription>Select a friend to invite to this circle.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2 max-h-72 overflow-y-auto py-1">
						{loadingFriends && <p className="text-sm text-muted-foreground text-center py-4">Loading friends…</p>}
						{!loadingFriends && friends.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								You have no friends yet. Add friends from the{" "}
								<button className="underline" onClick={() => navigate({ to: "/friends" })}>
									Friends
								</button>{" "}
								page.
							</p>
						)}
						{friends.map((friend) => {
							const status = inviteStatuses[friend.userId];
							return (
								<div key={friend.userId} className="flex items-center gap-3 px-1 py-1.5">
									<Avatar className="size-9 shrink-0">
										<AvatarImage src={friend.profilePictureUrl ?? undefined} />
										<AvatarFallback>{friend.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<span className="flex-1 text-sm font-medium truncate">{friend.displayName}</span>
									{status === "sent" ? (
										<span className="text-xs text-muted-foreground shrink-0">Invited</span>
									) : (
										<div className="flex flex-col items-end gap-0.5 shrink-0">
											<Button size="sm" variant="outline" disabled={status === "sending"} onClick={() => sendInvite(friend.userId)}>
												{status === "sending" ? "Sending…" : "Invite"}
											</Button>
											{status && status !== "sending" && <p className="text-xs text-destructive max-w-[160px] text-right">{status}</p>}
										</div>
									)}
								</div>
							);
						})}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Leave dialog */}
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

			{/* Post detail dialog */}
			<Dialog
				open={!!selectedPost}
				onOpenChange={(open) => {
					if (!open) setSelectedPost(null);
				}}
			>
				<DialogContent className="max-w-sm p-0 gap-0 overflow-hidden" showCloseButton={false}>
					<DialogHeader className="sr-only">
						<DialogTitle>Post</DialogTitle>
					</DialogHeader>
					{selectedPost && (
						<>
							{/* Author header */}
							<div className="flex items-center gap-2.5 px-3 py-2.5 border-b">
								<Avatar className="size-7 shrink-0">
									<AvatarImage src={selectedPost.authorProfilePictureUrl ?? undefined} />
									<AvatarFallback className="text-xs">{selectedPost.authorDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
								</Avatar>
								<span className="text-sm font-medium flex-1 truncate">{selectedPost.authorDisplayName}</span>
								<span className="text-xs text-muted-foreground shrink-0">
									{new Date(selectedPost.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
								</span>
								<DialogClose asChild>
									<Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-full opacity-60 hover:opacity-100">
										<X className="size-3.5" />
										<span className="sr-only">Close</span>
									</Button>
								</DialogClose>
							</div>

							{/* Media carousel */}
							{selectedPost.media.length > 0 && (
								<div className="relative bg-black">
									<Carousel setApi={setPostCarouselApi}>
										<CarouselContent className="ml-0">
											{selectedPost.media.map((m) => (
												<CarouselItem key={m.id} className="pl-0">
													{m.mediaType === "image" ? (
														<img src={m.blobUrl} alt="" className="w-full max-h-[65vh] object-contain" />
													) : (
														<video src={m.blobUrl} controls className="w-full max-h-[65vh]" />
													)}
												</CarouselItem>
											))}
										</CarouselContent>
										{selectedPost.media.length > 1 && (
											<>
												<CarouselPrevious className="left-2 size-7 bg-black/50 border-0 text-white hover:bg-black/70 hover:text-white" />
												<CarouselNext className="right-2 size-7 bg-black/50 border-0 text-white hover:bg-black/70 hover:text-white" />
											</>
										)}
									</Carousel>
									{selectedPost.media.length > 1 && (
										<div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
											{selectedPost.media.map((_, i) => (
												<div key={i} className={cn("size-1.5 rounded-full transition-colors", i === currentSlide ? "bg-white" : "bg-white/40")} />
											))}
										</div>
									)}
								</div>
							)}

							{/* Text */}
							{selectedPost.value && (
								<div className="px-3 py-3">
									<p className="text-sm whitespace-pre-wrap">{selectedPost.value}</p>
								</div>
							)}
						</>
					)}
				</DialogContent>
			</Dialog>

			<header className="px-4 pt-6 pb-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
				<div className="flex items-center gap-3 max-w-[600px] mx-auto">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Back">
								<ArrowLeft className="size-5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Back</TooltipContent>
					</Tooltip>
					<h1 className="text-lg font-semibold m-0 flex-1">{circle?.name ?? "…"}</h1>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
								aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
							>
								{viewMode === "grid" ? <List className="size-5" /> : <LayoutGrid className="size-5" />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{viewMode === "grid" ? "List view" : "Grid view"}</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button size="icon" variant="ghost" onClick={() => setInviteDialogOpen(true)} aria-label="Invite someone">
								<UserPlus className="size-5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Invite someone</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button size="icon" variant="ghost" onClick={() => setLeaveDialogOpen(true)} aria-label="Leave circle">
								<LogOut className="size-5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Leave circle</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button size="icon" variant="ghost" onClick={() => setShowForm((v) => !v)} aria-label={showForm ? "Cancel" : "New post"}>
								{showForm ? <X className="size-5" /> : <Plus className="size-5" />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{showForm ? "Cancel" : "New post"}</TooltipContent>
					</Tooltip>
					<ThemeToggle />
				</div>
			</header>

			<main className="flex-1 max-w-[600px] w-full mx-auto px-4 py-6 flex flex-col gap-6">
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
									<div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border shrink-0">
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
								<div key={post.id} className="relative aspect-square bg-muted overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
									{firstImage ? (
										<img src={firstImage.blobUrl} alt="" className="w-full h-full object-cover" />
									) : firstVideo ? (
										<video src={firstVideo.blobUrl} muted className="w-full h-full object-cover" />
									) : (
										<div className="w-full h-full flex items-center justify-center p-3">
											<p className="text-xs text-muted-foreground text-center line-clamp-4 leading-relaxed">{post.value}</p>
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
					<div className="flex flex-col gap-4">
						{posts.map((post) => (
							<PostCard key={post.id} post={post} />
						))}
					</div>
				)}
			</main>
		</div>
	);
}
