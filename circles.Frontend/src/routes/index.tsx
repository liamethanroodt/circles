// React
import { useState, useEffect } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { ConcentricRings } from "@/components/ConcentricRings";
import type { CircleRingData } from "@/components/ConcentricRings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Icons
import { UserRound, CirclePlus, Users } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

// UI
import { Button } from "@/components/ui/button";

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

interface UserInfo {
	displayName: string;
	bio: string | null;
	email: string;
}

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login", search: { confirmed: false } });
		}
	},
	component: HomePage,
});

function HomePage() {
	const navigate = useNavigate();
	const [circleRings, setCircleRings] = useState<CircleRingData[]>([]);
	const [loading, setLoading] = useState(true);
	const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [pendingCount, setPendingCount] = useState(0);

	useEffect(() => {
		const loadData = async () => {
			try {
				const circlesRes = await fetch("/api/circles");
				if (!circlesRes.ok) throw new Error("Failed to load circles");
				const circles: Circle[] = await circlesRes.json();

				const rings = await Promise.all(
					circles.map(async (circle) => {
						try {
							const postsRes = await fetch(`/api/posts/circle/${circle.id}`);
							const posts: Post[] = postsRes.ok ? await postsRes.json() : [];
							return {
								id: circle.id,
								name: circle.name,
								posts: posts.slice(0, 6).map((p) => ({
									id: p.id,
									imageUrl: p.media.find((m) => m.mediaType === "image")?.blobUrl,
									label: p.value.trim().slice(0, 2) || "?",
								})),
							};
						} catch {
							return { id: circle.id, name: circle.name, posts: [] };
						}
					}),
				);

				setCircleRings(rings);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Couldn't load circles");
			} finally {
				setLoading(false);
			}
		};

		loadData();

		fetch("/api/auth/me")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data?.profilePictureUrl) setProfilePictureUrl(data.profilePictureUrl);
				if (data) setUserInfo({ displayName: data.displayName ?? "", bio: data.bio ?? null, email: data.email ?? "" });
			})
			.catch(() => {});

		Promise.all([fetch("/api/friends/requests"), fetch("/api/invitations/")])
			.then(async ([reqRes, invRes]) => {
				const reqs = reqRes.ok ? await reqRes.json() : [];
				const invs = invRes.ok ? await invRes.json() : [];
				const received = reqs.filter((r: { direction: string }) => r.direction === "received").length;
				setPendingCount(received + invs.length);
			})
			.catch(() => {});
	}, []);

	return (
		<div className="w-full min-h-screen flex flex-col relative">
			<FloatingBackground />
			<header className="px-4 pt-6 pb-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
				<div className="flex justify-between items-center max-w-[600px] w-full mx-auto">
					<div className="flex items-center gap-2">
						<img src="/circles_logo_clear.svg" alt="" className="size-12" aria-hidden="true" />
						<h1 className="text-xl font-semibold m-0">Circles</h1>
					</div>
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" className="relative" onClick={() => navigate({ to: "/friends" })} aria-label="Friends">
									<Users className="size-5" />
									{pendingCount > 0 && (
										<span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground leading-none">
											{pendingCount}
										</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Friends</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/profile" })} aria-label="Your profile">
									<UserRound className="size-5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Your profile</TooltipContent>
						</Tooltip>
						<ThemeToggle />
					</div>
				</div>
			</header>
			<main className="flex-1 flex flex-col items-center justify-center p-10 gap-6">
				{!loading && (
					<ConcentricRings
						circles={circleRings}
						onCreateCircle={() => navigate({ to: "/circles/new" })}
						onCircleClick={(id) => {
							const ring = circleRings.find((r) => r.id === id);
							if (ring) navigate({ to: "/circles/$circleName", params: { circleName: ring.name } });
						}}
					>
						<HoverCard openDelay={300}>
							<HoverCardTrigger asChild>
								<div
									className="size-[160px] rounded-full overflow-hidden cursor-pointer shrink-0 bg-muted border border-border flex items-center justify-center"
									onClick={() => navigate({ to: "/profile" })}
								>
									{profilePictureUrl ? (
										<img src={profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
									) : (
										<UserRound className="size-16 text-muted-foreground" />
									)}
								</div>
							</HoverCardTrigger>
							<HoverCardContent className="w-64">
								<div className="flex gap-3">
									<Avatar className="size-10 shrink-0">
										<AvatarImage src={profilePictureUrl ?? undefined} />
										<AvatarFallback>{(userInfo?.displayName || userInfo?.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<div className="flex flex-col gap-0.5 min-w-0">
										{userInfo?.displayName && <p className="font-semibold text-sm leading-tight">{userInfo.displayName}</p>}
										{userInfo?.email && <p className="text-xs text-muted-foreground truncate">{userInfo.email}</p>}
										{userInfo?.bio && <p className="text-xs text-muted-foreground mt-1 leading-snug">{userInfo.bio}</p>}
									</div>
								</div>
							</HoverCardContent>
						</HoverCard>
					</ConcentricRings>
				)}
				{!loading && circleRings.length === 0 && (
					<div className="flex flex-col items-center gap-4 text-center max-w-sm">
						<div>
							<h2 className="text-lg font-semibold">You're not in any circles yet</h2>
							<p className="text-sm text-muted-foreground mt-1">
								Circles are private groups where you share posts with the people who matter most. Create your first circle to get started.
							</p>
						</div>
						<Button onClick={() => navigate({ to: "/circles/new" })}>
							<CirclePlus className="size-4" />
							Create a circle
						</Button>
					</div>
				)}
			</main>
			<footer className="flex justify-center gap-2 pb-6">
				<Button variant="ghost" size="icon" asChild>
					<a href="https://www.linkedin.com/in/liamroodt" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
						<svg role="img" viewBox="0 0 24 24" className="size-5 fill-current" xmlns="http://www.w3.org/2000/svg">
							<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
						</svg>
					</a>
				</Button>
				<Button variant="ghost" size="icon" asChild>
					<a href="https://github.com/liamethanroodt/circles" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
						<svg role="img" viewBox="0 0 24 24" className="size-5 fill-current" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
						</svg>
					</a>
				</Button>
			</footer>
		</div>
	);
}
