// React
import { useState } from "react";

// Notifications
import { toast } from "sonner";

// Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Icons
import { ArrowLeft } from "lucide-react";

// Background
import { FloatingBackground } from "@/components/FloatingBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

// Routing
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/circles/new")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login", search: { confirmed: false } });
		}
	},
	component: NewCirclePage,
});

function NewCirclePage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		setSubmitting(true);
		try {
			const res = await fetch("/api/circles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.errors?.[0] || "Failed to create circle");
			}
			toast.success("Circle created successfully");
			navigate({ to: "/circles/$circleName", params: { circleName: data.name } });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Couldn't create circle");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="w-full min-h-screen flex flex-col relative">
			<FloatingBackground />
			<header className="px-8 pt-10 pb-6 border-b border-border">
				<div className="flex items-center gap-4 max-w-[600px] w-full mx-auto">
					<Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Back">
						<ArrowLeft className="size-5" />
					</Button>
					<h1 className="text-2xl font-bold m-0 flex-1">New Circle</h1>
					<ThemeToggle />
				</div>
			</header>
			<main className="flex-1 flex items-start justify-center px-8 pt-10">
				<Card className="w-full max-w-[600px]">
					<CardHeader>
						<CardTitle>Create a Circle</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<Label htmlFor="circle-name">Circle name</Label>
								<Input
									id="circle-name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. Friends, Family, Work..."
									maxLength={200}
									autoFocus
								/>
							</div>
							<Button type="submit" disabled={!name.trim() || submitting}>
								{submitting ? "Creating..." : "Create Circle"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
