import { createFileRoute, redirect } from "@tanstack/react-router";
import AuthPage from "../AuthPage";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { checkAuth } = Route.useRouteContext();
	return <AuthPage onAuthenticated={checkAuth} />;
}
