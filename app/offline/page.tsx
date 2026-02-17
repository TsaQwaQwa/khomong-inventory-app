import Link from "next/link";

export default function OfflinePage() {
	return (
		<section className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-2xl font-semibold tracking-tight">
				You are offline
			</h1>
			<p className="text-sm text-muted-foreground">
				This page has not been cached on this device yet. Reconnect
				to load it once, then it will be available offline.
			</p>
			<div className="flex items-center gap-2">
				<Link
					href="/dashboard"
					className="rounded-md border px-3 py-2 text-sm"
				>
					Open dashboard
				</Link>
				<Link
					href="/"
					className="rounded-md border px-3 py-2 text-sm"
				>
					Retry
				</Link>
			</div>
		</section>
	);
}
