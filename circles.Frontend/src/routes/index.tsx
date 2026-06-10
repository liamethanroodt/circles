// React
import { useState, useEffect } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { ConcentricRings } from "@/components/ConcentricRings";
import type { CircleRingData } from "@/components/ConcentricRings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

// interface UserInfo {
// 	displayName: string;
// 	bio: string | null;
// 	email: string;
// }

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
	// const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
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
				// if (data) {
				// 	setUserInfo({
				// 		displayName: data.displayName ?? "",
				// 		bio: data.bio ?? null,
				// 		email: data.email ?? "",
				// 	});
				// }
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
					<h1 className="text-lg font-semibold m-0">Circles</h1>
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" className="relative" onClick={() => navigate({ to: "/friends" })} aria-label="People">
									<Users className="size-5" />
									{pendingCount > 0 && (
										<span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground leading-none">
											{pendingCount}
										</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>People</TooltipContent>
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
						<div className="flex flex-col items-center gap-2">
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
							{/* {userInfo && (
								<div className="text-center" style={{ maxWidth: 180 }}>
									{userInfo.displayName && <p className="font-semibold text-sm leading-tight">{userInfo.displayName}</p>}
									{userInfo.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-tight">{userInfo.bio}</p>}
									{userInfo.email && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{userInfo.email}</p>}
								</div>
							)} */}
						</div>
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
		</div>
	);
}
