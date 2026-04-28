import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import App from "./App";

const router = createRouter({
	routeTree,
	context: {
		isAuthenticated: false,
		email: null,
		checkAuth: async () => {},
		logout: async () => {},
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App router={router} />
	</StrictMode>,
);
