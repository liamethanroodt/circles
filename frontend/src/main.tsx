// React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Components
import App from "./App";

// Routing
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Styles
import "./styles/index.css";

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
