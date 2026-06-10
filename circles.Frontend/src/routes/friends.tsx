// React
import { useState, useEffect } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Icons
import { ArrowLeft, Check, UserPlus, Users, X } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

// Routing
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

interface UserSearchResult {
	userId: string;
	displayName: string;
	profilePictureUrl: string | null;
	friendshipStatus: "pending" | "accepted" | "declined" | null;
}

interface FriendRequest {
	id: string;
	requesterId: string;
	requesterDisplayName: string;
	requesterProfilePictureUrl: string | null;
	addresseeId: string;
	addresseeDisplayName: string;
	addresseeProfilePictureUrl: string | null;
	status: string;
	direction: "sent" | "received";
	createdAt: string;
}

interface Friend {
	userId: string;
	displayName: string;
	profilePictureUrl: string | null;
}

interface CircleInvitation {
	id: string;
	circleId: string;
	circleName: string;
	inviterId: string;
	inviterDisplayName: string;
	inviterProfilePictureUrl: string | null;
	createdAt: string;
}

export const Route = createFileRoute("/friends")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login", search: { confirmed: false } });
		}
	},
	component: FriendsPage,
});

function FriendsPage() {
	const navigate = useNavigate();

	const [searchEmail, setSearchEmail] = useState("");
	const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searching, setSearching] = useState(false);
	const [sendingRequest, setSendingRequest] = useState(false);

	const [requests, setRequests] = useState<FriendRequest[]>([]);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [invitations, setInvitations] = useState<CircleInvitation[]>([]);
	const [loading, setLoading] = useState(true);

	const loadData = async () => {
		try {
			const [reqRes, friendsRes, invRes] = await Promise.all([fetch("/api/friends/requests"), fetch("/api/friends/"), fetch("/api/invitations/")]);
			if (reqRes.ok) setRequests(await reqRes.json());
			if (friendsRes.ok) setFriends(await friendsRes.json());
			if (invRes.ok) setInvitations(await invRes.json());
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!searchEmail.trim()) return;
		setSearching(true);
		setSearchError(null);
		setSearchResult(null);
		try {
			const res = await fetch(`/api/users/search?email=${encodeURIComponent(searchEmail.trim())}`);
			if (res.status === 404) {
				setSearchError("No account found with that email address.");
				return;
			}
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setSearchError(data.errors?.[0] ?? "Search failed.");
				return;
			}
			setSearchResult(await res.json());
		} finally {
			setSearching(false);
		}
	};

	const sendFriendRequest = async () => {
		if (!searchEmail.trim()) return;
		setSendingRequest(true);
		try {
			const res = await fetch("/api/friends/request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ addresseeEmail: searchEmail.trim() }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.errors?.[0] ?? "Couldn't send request");
				return;
			}
			setSearchResult((prev) => (prev ? { ...prev, friendshipStatus: "pending" } : prev));
			toast.success("Request sent");
			await loadData();
		} finally {
			setSendingRequest(false);
		}
	};

	const acceptRequest = async (id: string) => {
		const res = await fetch(`/api/friends/requests/${id}/accept`, { method: "PUT" });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.errors?.[0] ?? "Couldn't accept request");
			return;
		}
		toast.success("Friend added");
		await loadData();
	};

	const declineRequest = async (id: string) => {
		const res = await fetch(`/api/friends/requests/${id}/decline`, { method: "PUT" });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.errors?.[0] ?? "Couldn't decline request");
			return;
		}
		await loadData();
	};

	const acceptInvitation = async (id: string, circleName: string) => {
		const res = await fetch(`/api/invitations/${id}/accept`, { method: "PUT" });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.errors?.[0] ?? "Couldn't accept invitation");
			return;
		}
		await loadData();
		toast.success("Joined circle");
		navigate({ to: "/circles/$circleName", params: { circleName } });
	};

	const declineInvitation = async (id: string) => {
		const res = await fetch(`/api/invitations/${id}/decline`, { method: "PUT" });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.errors?.[0] ?? "Couldn't decline invitation");
			return;
		}
		await loadData();
	};

	const unfriend = async (userId: string) => {
		const res = await fetch(`/api/friends/${userId}`, { method: "DELETE" });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.errors?.[0] ?? "Couldn't remove friend");
			return;
		}
		await loadData();
	};

	const receivedRequests = requests.filter((r) => r.direction === "received");
	const sentRequests = requests.filter((r) => r.direction === "sent");
	const pendingCount = receivedRequests.length + invitations.length;

	return (
		<div className="w-full min-h-screen flex flex-col relative">
			<FloatingBackground />
			<header className="px-4 pt-6 pb-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
				<div className="flex items-center gap-3 max-w-[600px] mx-auto">
					<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Back">
						<ArrowLeft className="size-5" />
					</Button>
					<h1 className="text-lg font-semibold m-0 flex-1">Friends</h1>
					{pendingCount > 0 && (
						<Badge variant="destructive" className="text-xs">
							{pendingCount}
						</Badge>
					)}
					<ThemeToggle />
				</div>
			</header>
			<main className="flex-1 max-w-[600px] w-full mx-auto px-4 py-6 flex flex-col gap-8">
				{/* Search */}
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Find people</h2>
					<form onSubmit={handleSearch} className="flex gap-2">
						<Input
							type="email"
							placeholder="Search by email address"
							value={searchEmail}
							onChange={(e) => {
								setSearchEmail(e.target.value);
								setSearchResult(null);
								setSearchError(null);
							}}
							className="flex-1"
						/>
						<Button type="submit" disabled={!searchEmail.trim() || searching}>
							{searching ? "Searching…" : "Search"}
						</Button>
					</form>
					{searchError && <p className="text-sm text-destructive">{searchError}</p>}
					{searchResult && (
						<div className="flex items-center gap-3 p-3 rounded-lg border border-border">
							<Avatar className="size-10 shrink-0">
								<AvatarImage src={searchResult.profilePictureUrl ?? undefined} />
								<AvatarFallback>{searchResult.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="font-medium text-sm truncate">{searchResult.displayName}</p>
								<p className="text-xs text-muted-foreground truncate">{searchEmail}</p>
							</div>
							{searchResult.friendshipStatus === "accepted" ? (
								<span className="text-xs text-muted-foreground">Friends</span>
							) : searchResult.friendshipStatus === "pending" ? (
								<span className="text-xs text-muted-foreground">Request sent</span>
							) : (
								<Button size="sm" onClick={sendFriendRequest} disabled={sendingRequest}>
									<UserPlus className="size-3.5 mr-1.5" />
									{sendingRequest ? "Sending…" : "Add friend"}
								</Button>
							)}
						</div>
					)}
				</section>
				{!loading && (receivedRequests.length > 0 || invitations.length > 0) && (
					<>
						<Separator />
						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
								Pending
								{pendingCount > 0 && (
									<Badge variant="secondary" className="ml-2 text-xs font-normal normal-case tracking-normal">
										{pendingCount}
									</Badge>
								)}
							</h2>
							{receivedRequests.map((req) => (
								<div key={req.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
									<Avatar className="size-10 shrink-0">
										<AvatarImage src={req.requesterProfilePictureUrl ?? undefined} />
										<AvatarFallback>{req.requesterDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">{req.requesterDisplayName}</p>
										<p className="text-xs text-muted-foreground">Wants to be your friend</p>
									</div>
									<div className="flex gap-1.5 shrink-0">
										<Button size="icon" variant="outline" className="size-8" onClick={() => acceptRequest(req.id)} aria-label="Accept">
											<Check className="size-4" />
										</Button>
										<Button size="icon" variant="ghost" className="size-8" onClick={() => declineRequest(req.id)} aria-label="Decline">
											<X className="size-4" />
										</Button>
									</div>
								</div>
							))}
							{invitations.map((inv) => (
								<div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
									<Avatar className="size-10 shrink-0">
										<AvatarImage src={inv.inviterProfilePictureUrl ?? undefined} />
										<AvatarFallback>{inv.inviterDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">{inv.inviterDisplayName}</p>
										<p className="text-xs text-muted-foreground">
											Invited you to <span className="font-medium">{inv.circleName}</span>
										</p>
									</div>
									<div className="flex gap-1.5 shrink-0">
										<Button
											size="icon"
											variant="outline"
											className="size-8"
											onClick={() => acceptInvitation(inv.id, inv.circleName)}
											aria-label="Accept"
										>
											<Check className="size-4" />
										</Button>
										<Button size="icon" variant="ghost" className="size-8" onClick={() => declineInvitation(inv.id)} aria-label="Decline">
											<X className="size-4" />
										</Button>
									</div>
								</div>
							))}
						</section>
					</>
				)}
				{!loading && sentRequests.length > 0 && (
					<>
						<Separator />
						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sent requests</h2>
							{sentRequests.map((req) => (
								<div key={req.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
									<Avatar className="size-10 shrink-0">
										<AvatarImage src={req.addresseeProfilePictureUrl ?? undefined} />
										<AvatarFallback>{req.addresseeDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">{req.addresseeDisplayName}</p>
										<p className="text-xs text-muted-foreground">Request pending</p>
									</div>
								</div>
							))}
						</section>
					</>
				)}
				{!loading && (
					<>
						<Separator />
						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
								Friends
								{friends.length > 0 && (
									<Badge variant="secondary" className="ml-2 text-xs font-normal normal-case tracking-normal">
										{friends.length}
									</Badge>
								)}
							</h2>
							{friends.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
									<div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
										<Users className="size-6" />
									</div>
									<p className="text-sm text-muted-foreground">No friends yet. Search for people above to get started.</p>
								</div>
							) : (
								friends.map((friend) => (
									<div key={friend.userId} className="flex items-center gap-3 p-3 rounded-lg border border-border">
										<Avatar className="size-10 shrink-0">
											<AvatarImage src={friend.profilePictureUrl ?? undefined} />
											<AvatarFallback>{friend.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">{friend.displayName}</p>
										</div>
										<Button size="sm" variant="ghost" className="text-xs text-muted-foreground shrink-0" onClick={() => unfriend(friend.userId)}>
											Remove
										</Button>
									</div>
								))
							)}
						</section>
					</>
				)}
			</main>
		</div>
	);
}
