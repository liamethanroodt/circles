export function FloatingBackground() {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
			<div className="login-float-a absolute -top-20 -right-10 size-72 rounded-full bg-violet-300/10 dark:bg-violet-500/15 blur-3xl" />
			<div className="login-float-b absolute -bottom-16 -left-16 size-80 rounded-full bg-indigo-300/10 dark:bg-indigo-500/15 blur-3xl" />
			<div className="login-float-c absolute top-1/2 left-1/3 size-48 rounded-full bg-purple-200/8 dark:bg-purple-500/12 blur-2xl" />
			<div className="login-float-b absolute -top-32 -left-32 size-[480px] rounded-full border border-violet-300/25 dark:border-violet-500/20" />
			<div className="login-float-b absolute -top-16 -left-16 size-[280px] rounded-full border border-violet-300/35 dark:border-violet-500/30" />
			<div className="login-float-a absolute top-1/3 -right-28 size-[360px] rounded-full border border-indigo-300/25 dark:border-indigo-500/20" />
			<div className="login-float-a absolute top-1/3 -right-10 size-[200px] rounded-full border border-indigo-300/35 dark:border-indigo-500/30" />
			<div className="login-float-c absolute -bottom-24 left-1/4 size-[300px] rounded-full border border-purple-300/25 dark:border-purple-500/20" />
			<div className="login-float-c absolute -bottom-10 left-2/3 size-[140px] rounded-full border border-purple-300/35 dark:border-purple-500/30" />
		</div>
	);
}
