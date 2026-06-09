// Routing
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

// Components
import { Toaster } from "@/components/ui/sonner";

export interface AuthContext {
	isAuthenticated: boolean;
	email: string | null;
	checkAuth: (email?: string) => Promise<void>;
	logout: () => Promise<void>;
}

export const Route = createRootRouteWithContext<AuthContext>()({
	component: RootLayout,
});

function RootLayout() {
	return (
		<>
			<Outlet />
			<Toaster />
		</>
	);
}
