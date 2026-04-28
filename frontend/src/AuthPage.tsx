import { useState } from "react";
import { CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AuthPageProps {
	onAuthenticated: (email: string) => void;
}

function AuthPage({ onAuthenticated }: AuthPageProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("login");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setLoading(true);

		const isLogin = activeTab === "login";
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
				onAuthenticated(email);
			} else {
				setActiveTab("login");
				setSuccess("Account created! Sign in with your credentials.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<CircleDot className="size-4" />
					</div>
					Circles
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(v: string) => {
						setActiveTab(v);
						setError(null);
						setSuccess(null);
					}}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="login">Sign In</TabsTrigger>
						<TabsTrigger value="register">Create Account</TabsTrigger>
					</TabsList>

					<TabsContent value="login">
						<Card>
							<CardHeader className="text-center">
								<CardTitle className="text-xl">Welcome back</CardTitle>
								<CardDescription>Sign in to your Circles account</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSubmit} className="flex flex-col gap-4">
									{success && (
										<Alert>
											<AlertDescription>{success}</AlertDescription>
										</Alert>
									)}
									{error && (
										<Alert variant="destructive">
											<AlertDescription>{error}</AlertDescription>
										</Alert>
									)}
									<div className="flex flex-col gap-2">
										<Label htmlFor="login-email">Email</Label>
										<Input
											id="login-email"
											type="email"
											placeholder="you@example.com"
											value={email}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
											required
											autoComplete="email"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor="login-password">Password</Label>
										<Input
											id="login-password"
											type="password"
											placeholder="••••••••"
											value={password}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
											required
											autoComplete="current-password"
										/>
									</div>
									<Button type="submit" className="w-full" disabled={loading || !email.trim() || !password.trim()}>
										{loading ? "Signing in…" : "Sign In"}
									</Button>
								</form>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="register">
						<Card>
							<CardHeader className="text-center">
								<CardTitle className="text-xl">Create an account</CardTitle>
								<CardDescription>Share your thoughts in circles</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSubmit} className="flex flex-col gap-4">
									{error && (
										<Alert variant="destructive">
											<AlertDescription>{error}</AlertDescription>
										</Alert>
									)}
									<div className="flex flex-col gap-2">
										<Label htmlFor="register-display-name">Display Name</Label>
										<Input
											id="register-display-name"
											type="text"
											placeholder="Your name"
											value={displayName}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
											required
											autoComplete="name"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor="register-email">Email</Label>
										<Input
											id="register-email"
											type="email"
											placeholder="you@example.com"
											value={email}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
											required
											autoComplete="email"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor="register-password">Password</Label>
										<Input
											id="register-password"
											type="password"
											placeholder="••••••••"
											value={password}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
											required
											minLength={6}
											autoComplete="new-password"
										/>
										<p className="text-xs text-muted-foreground">At least 6 characters with an uppercase letter and a digit.</p>
									</div>
									<Button type="submit" className="w-full" disabled={loading || !email.trim() || !password.trim() || !displayName.trim()}>
										{loading ? "Creating account…" : "Create Account"}
									</Button>
								</form>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

export default AuthPage;
