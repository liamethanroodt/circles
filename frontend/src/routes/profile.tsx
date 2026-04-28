import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login" });
		}
	},
	component: ProfilePage,
});

function ProfilePage() {
	const { email } = Route.useRouteContext();
	const navigate = useNavigate();

	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [saved, setSaved] = useState(false);

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		// TODO: persist to API
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	return (
		<div style={{ position: "relative", minHeight: "100vh" }}>
			{/* Red circle — top third, horizontally centered */}
			<div
				style={
					{
						backgroundColor: "red",
						borderRadius: 999,
						width: 150,
						height: 150,
						position: "absolute",
						left: "50%",
						top: "33.33%",
						transform: "translate(-50%, -50%)",
						viewTransitionName: "red-circle",
					} as React.CSSProperties
				}
			/>

			<div
				style={{
					maxWidth: 480,
					margin: "0 auto",
					padding: "24px 16px",
					paddingTop: "calc(33.33% + 100px)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
					<button onClick={() => navigate({ to: "/", viewTransition: true })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>
						←
					</button>
					<h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Profile</h1>
				</div>

				<form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						<label style={{ fontSize: 13, fontWeight: 500, color: "#666" }}>Email</label>
						<input
							type="text"
							value={email ?? ""}
							disabled
							style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#f5f5f5", color: "#888", fontSize: 14 }}
						/>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						<label htmlFor="display-name" style={{ fontSize: 13, fontWeight: 500, color: "#666" }}>
							Display name
						</label>
						<input
							id="display-name"
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Enter your display name"
							maxLength={80}
							style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
						/>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						<label htmlFor="bio" style={{ fontSize: 13, fontWeight: 500, color: "#666" }}>
							Bio
						</label>
						<textarea
							id="bio"
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							placeholder="Tell people a little about yourself"
							rows={4}
							maxLength={300}
							style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, resize: "vertical" }}
						/>
					</div>

					<button
						type="submit"
						style={{
							padding: "10px 0",
							borderRadius: 8,
							border: "none",
							background: "#111",
							color: "#fff",
							fontSize: 14,
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						{saved ? "Saved!" : "Save changes"}
					</button>
				</form>
			</div>
		</div>
	);
}
