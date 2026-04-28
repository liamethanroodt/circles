import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import "../App.css";

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
	return <Outlet />;
}
