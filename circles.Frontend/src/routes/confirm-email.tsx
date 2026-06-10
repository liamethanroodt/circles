// React
import { useEffect, useState } from "react";

// Icons
import { CircleDot, Loader2 } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";

// Routing
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/confirm-email")({
	// TanStack Router validates and coerces the search parameters. Both fields are
	// extracted from the query string that the email link placed there (e.g.
	// /confirm-email?userId=ABC&token=XYZ). Defaulting to empty strings lets the
	// component display a clear error when the link is malformed rather than crashing.
	validateSearch: (search: Record<string, unknown>) => ({
		userId: String(search.userId ?? ""),
		token: String(search.token ?? ""),
	}),
	component: ConfirmEmailPage,
});

type Status = "loading" | "success" | "error";

function ConfirmEmailPage() {
	const { userId, token } = Route.useSearch();
	const navigate = useNavigate();
	const [status, setStatus] = useState<Status>("loading");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		// Guard: if either param is missing the link is definitely invalid.
		if (!userId || !token) {
			setStatus("error");
			setErrorMessage("This confirmation link is invalid or incomplete. Please register again.");
			return;
		}

		const confirmEmail = async () => {
			try {
				// POST to the backend confirm-email endpoint. The server Base64Url-decodes the
				// userId and token, then calls UserManager.ConfirmEmailAsync which validates the
				// data-protected token against the user's current SecurityStamp.
				const response = await fetch("/api/auth/confirm-email", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId, token }),
				});

				const data = await response.json();

				if (!response.ok) {
					setStatus("error");
					setErrorMessage(data.errors?.[0] ?? "Confirmation failed. The link may have expired.");
					return;
				}

				setStatus("success");

				// Short delay so the user can read the success message, then redirect to the
				// login page with confirmed=true so it shows a welcome banner.
				setTimeout(() => navigate({ to: "/login", search: { confirmed: true } }), 2500);
			} catch {
				setStatus("error");
				setErrorMessage("Something went wrong. Please try again or contact support.");
			}
		};

		confirmEmail();
	}, [userId, token, navigate]);

	return (
		<div className="relative overflow-hidden flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<FloatingBackground />
			<div className="flex items-center gap-2 font-medium">
				<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<CircleDot className="size-4" />
				</div>
				<span className="font-fascinate">Circles</span>
			</div>

			<div className="w-full max-w-sm text-center">
				{status === "loading" && (
					<div className="flex flex-col items-center gap-3">
						<Loader2 className="size-8 animate-spin text-primary" />
						<p className="text-muted-foreground">Confirming your email address…</p>
					</div>
				)}

				{status === "success" && (
					<div className="flex flex-col items-center gap-3">
						<p className="text-lg font-semibold text-green-600">Email confirmed!</p>
						<p className="text-muted-foreground text-sm">Redirecting you to sign in…</p>
					</div>
				)}

				{status === "error" && (
					<div className="flex flex-col items-center gap-4">
						<p className="text-sm text-destructive">{errorMessage}</p>
						<Link to="/login" search={{ confirmed: false }} className="text-sm text-primary underline underline-offset-4">
							Back to sign in
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
