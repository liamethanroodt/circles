// React
import { useEffect, useRef, useState } from "react";

// Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
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
			setSuccess("Profile saved.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred.");
		} finally {
			setSaving(false);
		}
	};

	const handlePictureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setError(null);
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
			setSuccess("Profile picture updated.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed.");
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
	}, []);

	const initials = (displayName || profile?.email || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex justify-between items-center">
					{/* <Button variant="ghost" className="self-start" onClick={() => navigate({ to: "/", viewTransition: true })}> */}
					<Button variant="ghost" className="self-start" onClick={() => navigate({ to: "/" })}>
						← Back
					</Button>
					<Button variant="outline" size="sm" onClick={logout}>
						Sign Out
					</Button>
				</div>

				<Card>
					<CardHeader className="text-center">
						<div className="flex justify-center mb-2">
							<div className="relative">
								<Avatar className="size-20">
									<AvatarImage src={profile?.profilePictureUrl ?? undefined} />
									<AvatarFallback className="text-lg">{initials}</AvatarFallback>
								</Avatar>
								<Button
									variant="outline"
									size="sm"
									className="absolute -bottom-2 -right-2 size-8 rounded-full p-0"
									onClick={() => fileInputRef.current?.click()}
									disabled={uploadingPicture}
									type="button"
								>
									{uploadingPicture ? "…" : "✎"}
								</Button>
								<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureSelect} />
							</div>
						</div>
						<CardTitle className="text-xl">{profile?.displayName || "Your Profile"}</CardTitle>
						<CardDescription>{profile?.email}</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSave} className="flex flex-col gap-4">
							{success && (
								<Alert variant="success">
									<AlertDescription>{success}</AlertDescription>
								</Alert>
							)}
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}
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
							<Button type="submit" className="w-full" disabled={saving || !displayName.trim()}>
								{saving ? "Saving…" : "Save Changes"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
