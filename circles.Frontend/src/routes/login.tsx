// React
import { useEffect, useState } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Routing
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/" });
		}
	},
	// Validate the optional ?confirmed=true query param placed by /confirm-email on success.
	validateSearch: (search: Record<string, unknown>) => ({
		confirmed: search.confirmed === true || search.confirmed === "true",
	}),
	component: LoginPage,
});

function LoginPage() {
	const { checkAuth } = Route.useRouteContext();
	const { confirmed } = Route.useSearch();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [loading, setLoading] = useState(false);
	const [mode, setMode] = useState<"login" | "register">("login");

	useEffect(() => {
		if (confirmed) toast.success("Email confirmed");
	}, []);

	const isLogin = mode === "login";

	const switchMode = (next: "login" | "register") => {
		setMode(next);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

		try {
			const body = isLogin ? { email, password } : { email, password, displayName };

			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.errors?.[0] || "Something went wrong.");
			}

			if (isLogin) {
				checkAuth(email);
			} else {
				// Stay on the register view and show the check-your-email message.
				// Don't switch to login — the user can't sign in yet.
				toast.success("Check your inbox to confirm your account");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			{/* Left column — branding panel, hidden on mobile */}
			<div className="login-panel relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center p-10 text-white">
				{/* Blurred glow blobs */}
				<div className="login-float-a absolute -top-20 -right-10 size-72 rounded-full bg-violet-400/25 blur-3xl" />
				<div className="login-float-b absolute -bottom-16 -left-16 size-80 rounded-full bg-indigo-500/20 blur-3xl" />
				<div className="login-float-c absolute top-1/2 left-1/3 size-48 rounded-full bg-purple-300/15 blur-2xl" />
				{/* Circle ring decorations */}
				<div className="login-float-b absolute -top-32 -left-32 size-[480px] rounded-full border border-white/8" />
				<div className="login-float-b absolute -top-16 -left-16 size-[280px] rounded-full border border-white/10" />
				<div className="login-float-a absolute top-1/3 -right-28 size-[360px] rounded-full border border-white/8" />
				<div className="login-float-a absolute top-1/3 -right-10 size-[200px] rounded-full border border-white/10" />
				<div className="login-float-c absolute -bottom-24 left-1/4 size-[300px] rounded-full border border-white/8" />
				<div className="login-float-c absolute -bottom-10 left-2/3 size-[140px] rounded-full border border-white/10" />
				{/* Branding */}
				<div className="relative z-10 flex flex-col items-center gap-6 text-center">
					<img src="/circles_logo.svg" alt="Circles logo" className="size-50" />
					<span className="text-6xl font-bold tracking-tight font-fascinate">Circles</span>
					<p className="max-w-xs text-lg text-white/75">Share with the people that matter</p>
				</div>
			</div>
			{/* Right column — form, full width on mobile */}
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-sm">
						<div className="flex flex-col gap-6">
							{/* Branding shown only on mobile */}
							<div className="flex flex-col items-center gap-2 pb-2 lg:hidden">
								<img src="/circles_logo.svg" alt="Circles logo" className="size-50" />
								<span className="text-4xl font-bold tracking-tight font-fascinate">Circles</span>
								<p className="text-sm text-muted-foreground">Share with the people that matter</p>
							</div>
							<div className="text-center hidden lg:block">
								<h1 className="text-xl font-semibold">{isLogin ? "Welcome back" : "Create an account"}</h1>
								<p className="text-sm text-muted-foreground">{isLogin ? "Sign in to your Circles account" : "Share your thoughts in circles"}</p>
							</div>
							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
								{!isLogin && (
									<div className="flex flex-col gap-2">
										<Label htmlFor="display-name">Display Name</Label>
										<Input
											id="display-name"
											type="text"
											placeholder="Your name"
											value={displayName}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
											required
											autoComplete="name"
										/>
									</div>
								)}
								<div className="flex flex-col gap-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
										required
										autoComplete="email"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="password">Password</Label>
									<Input
										id="password"
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
										required
										minLength={isLogin ? undefined : 6}
										autoComplete={isLogin ? "current-password" : "new-password"}
									/>
									{!isLogin && <p className="text-xs text-muted-foreground">At least 6 characters with an uppercase letter and a digit.</p>}
								</div>
								<Button type="submit" className="w-full" disabled={loading || !email.trim() || !password.trim() || (!isLogin && !displayName.trim())}>
									{loading ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign In" : "Create Account"}
								</Button>
								<p className="text-center text-sm text-muted-foreground">
									{isLogin ? (
										<>
											Don't have an account?{" "}
											<button type="button" onClick={() => switchMode("register")} className="underline underline-offset-4 hover:text-primary">
												Sign up
											</button>
										</>
									) : (
										<>
											Already have an account?{" "}
											<button type="button" onClick={() => switchMode("login")} className="underline underline-offset-4 hover:text-primary">
												Sign in
											</button>
										</>
									)}
								</p>
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
