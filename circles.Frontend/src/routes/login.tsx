// React
import { useState } from "react";

// Components
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Icons
import { CircleDot } from "lucide-react";

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
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(confirmed ? "Email confirmed! You can now sign in." : null);
	const [loading, setLoading] = useState(false);
	const [mode, setMode] = useState<"login" | "register">("login");

	const isLogin = mode === "login";

	const switchMode = (next: "login" | "register") => {
		setMode(next);
		setError(null);
		setSuccess(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
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
				setSuccess("Account created! Please check your email to confirm your address before signing in.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			{/* Left column — branding panel, hidden on mobile */}
			<div className="relative hidden bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center p-10 text-primary-foreground">
				<div className="flex flex-col items-center gap-6 text-center">
					<div className="flex items-center gap-3">
						<div className="flex size-12 items-center justify-center rounded-xl bg-primary-foreground text-primary">
							<CircleDot className="size-7" />
						</div>
						<span className="text-3xl font-bold tracking-tight">Circles</span>
					</div>
					<p className="max-w-xs text-lg opacity-80">Share your thoughts and connect with the people that matter.</p>
				</div>
			</div>
			{/* Right column — form, full width on mobile */}
			<div className="flex flex-col gap-4 p-6 md:p-10">
				{/* Logo shown only on mobile */}
				<div className="flex justify-center lg:hidden">
					<div className="flex items-center gap-2 font-medium">
						<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
							<CircleDot className="size-4" />
						</div>
						Circles
					</div>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-sm">
						<div className="flex flex-col gap-6">
							<div className="text-center">
								<h1 className="text-xl font-semibold">{isLogin ? "Welcome back" : "Create an account"}</h1>
								<p className="text-sm text-muted-foreground">{isLogin ? "Sign in to your Circles account" : "Share your thoughts in circles"}</p>
							</div>
							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
