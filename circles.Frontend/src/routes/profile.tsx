// React
import { useEffect, useRef, useState } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Icons
import { ArrowLeft, Pencil, Users } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

// Routing
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login", search: { confirmed: false } });
		}
	},
	component: ProfilePage,
});

interface Friend {
	userId: string;
	displayName: string;
	profilePictureUrl: string | null;
}

interface UserProfile {
	email: string;
	displayName: string;
	bio: string | null;
	profilePictureUrl: string | null;
}

function ProfilePage() {
	const { logout } = Route.useRouteContext();
	const navigate = useNavigate();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [saving, setSaving] = useState(false);
	const [uploadingPicture, setUploadingPicture] = useState(false);
	// const [friends, setFriends] = useState<Friend[]>([]);
	const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

	const hasChanges = displayName !== (profile?.displayName ?? "") || bio !== (profile?.bio ?? "");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);

		try {
			const response = await fetch("/api/auth/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ displayName, bio: bio || null }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.errors?.[0] || "Failed to save profile.");
			}

			setProfile((prev) => (prev ? { ...prev, ...data } : prev));
			toast.success("Saved");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	};

	const handlePictureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploadingPicture(true);

		try {
			const urlRes = await fetch("/api/auth/profile/picture-upload-url");
			if (!urlRes.ok) throw new Error("Failed to get upload URL.");
			const { uploadUrl, publicUrl } = await urlRes.json();

			const uploadRes = await fetch(uploadUrl, {
				method: "PUT",
				headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "image/jpeg" },
				body: file,
			});

			if (!uploadRes.ok) throw new Error("Upload failed.");

			setProfile((prev) => (prev ? { ...prev, profilePictureUrl: `${publicUrl}?t=${Date.now()}` } : prev));
			toast.success("Photo updated");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setUploadingPicture(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	useEffect(() => {
		fetch("/api/auth/me")
			.then((r) => r.json())
			.then((data) => {
				if (data.isAuthenticated) {
					setProfile(data);
					setDisplayName(data.displayName ?? "");
					setBio(data.bio ?? "");
				}
			});

		// fetch("/api/friends/")
		// 	.then((r) => (r.ok ? r.json() : []))
		// 	.then(setFriends)
		// 	.catch(() => {});
	}, []);

	const initials = (displayName || profile?.email || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<div className="w-full min-h-screen flex flex-col relative">
			<Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sign out?</DialogTitle>
						<DialogDescription>You'll need to sign in again to access your circles.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setSignOutDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={logout}>
							Sign Out
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<FloatingBackground />
			<header className="px-4 pt-6 pb-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
				<div className="flex items-center gap-3 max-w-[600px] mx-auto">
					<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Back">
						<ArrowLeft className="size-5" />
					</Button>
					<h1 className="text-lg font-semibold m-0 flex-1">Profile</h1>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/friends" })} aria-label="Friends">
								<Users className="size-5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Friends</TooltipContent>
					</Tooltip>
					<ThemeToggle />
					<Button variant="outline" size="sm" onClick={() => setSignOutDialogOpen(true)}>
						Sign Out
					</Button>
				</div>
			</header>

			<main className="flex-1 max-w-[600px] w-full mx-auto px-4 py-6 flex flex-col gap-8">
				{/* Profile card */}
				<section className="flex flex-col items-center gap-4">
					<div className="relative">
						<Avatar className="size-24">
							<AvatarImage src={profile?.profilePictureUrl ?? undefined} />
							<AvatarFallback className="text-xl">{initials}</AvatarFallback>
						</Avatar>
						<Button
							variant="outline"
							size="sm"
							className="absolute -bottom-2 -right-2 size-8 rounded-full p-0"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploadingPicture}
							type="button"
						>
							{uploadingPicture ? "…" : <Pencil className="size-3.5" />}
						</Button>
						<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureSelect} />
					</div>
					<div className="text-center">
						<p className="font-semibold">{profile?.displayName || "Your Profile"}</p>
						<p className="text-sm text-muted-foreground mt-0.5">{profile?.email}</p>
						{profile?.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
					</div>
				</section>
				<Separator />
				{/* Friends */}
				{/* <section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
						Friends
						{friends.length > 0 && (
							<span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal normal-case tracking-normal text-secondary-foreground">
								{friends.length}
							</span>
						)}
					</h2>
					{friends.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
							<div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<Users className="size-6" />
							</div>
							<p className="text-sm text-muted-foreground">No friends yet.</p>
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
							</div>
						))
					)}
				</section>
				<Separator /> */}
				{/* Edit profile */}
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Edit profile</h2>
					<form onSubmit={handleSave} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="display-name">Display Name</Label>
							<Input
								id="display-name"
								type="text"
								value={displayName}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea
								id="bio"
								placeholder="Tell people a little about yourself…"
								value={bio}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
								maxLength={160}
								rows={3}
							/>
							<p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
						</div>
						<Button type="submit" disabled={saving || !displayName.trim() || !hasChanges}>
							{saving ? "Saving…" : "Save Changes"}
						</Button>
					</form>
				</section>
			</main>
		</div>
	);
}
