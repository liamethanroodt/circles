// React
import { useState } from "react";

// Components
import { Button } from "@/components/ui/button";

// Icons
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
	const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

	const toggle = () => {
		const next = !dark;
		setDark(next);
		document.documentElement.classList.toggle("dark", next);
		localStorage.setItem("theme", next ? "dark" : "light");
	};

	return (
		<Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
			{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
		</Button>
	);
}
