// React
import { useState, useEffect } from "react";

// Components
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConcentricRings } from "@/components/ConcentricRings";
import type { CircleRingData } from "@/components/ConcentricRings";

// Icons
import { UserRound, CirclePlus } from "lucide-react";

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
	const [error, setError] = useState<string | null>(null);
	const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

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
				setError(err instanceof Error ? err.message : "Failed to load circles");
			} finally {
				setLoading(false);
			}
		};

		loadData();

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
			<main className="flex-1 flex flex-col items-center justify-center p-10 gap-6">
				{error && (
					<Alert variant="destructive" aria-live="polite" className="max-w-md w-full">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				{!loading && (
					<ConcentricRings
						circles={circleRings}
						onCreateCircle={() => navigate({ to: "/circles/new" })}
						onCircleClick={(id) => {
							const ring = circleRings.find((r) => r.id === id);
							if (ring) navigate({ to: "/circles/$circleName", params: { circleName: ring.name } });
						}}
					>
						<Avatar size="lg" className="size-[75px] cursor-pointer" onClick={() => navigate({ to: "/profile", viewTransition: true })}>
							<AvatarImage src={profilePictureUrl ?? undefined} />
							<AvatarFallback>
								<UserRound className="size-8" />
							</AvatarFallback>
						</Avatar>
					</ConcentricRings>
				)}
				{!loading && !error && circleRings.length === 0 && (
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
