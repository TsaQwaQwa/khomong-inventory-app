"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GlobalSearchResult {
	id: string;
	type: "PRODUCT" | "CUSTOMER" | "TRANSACTION";
	title: string;
	description: string;
	href: string;
}

async function fetchResults(query: string) {
	const res = await fetch(
		`/api/search/global?q=${encodeURIComponent(query)}&limit=8`,
	);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return [] as GlobalSearchResult[];
	return (json?.data ?? json) as GlobalSearchResult[];
}

export function GlobalCommandSearch() {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [loading, setLoading] = React.useState(false);
	const [results, setResults] = React.useState<
		GlobalSearchResult[]
	>([]);

	React.useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const key =
				typeof event.key === "string"
					? event.key.toLowerCase()
					: "";
			const isK = key === "k";
			if ((event.metaKey || event.ctrlKey) && isK) {
				event.preventDefault();
				setOpen((prev) => !prev);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	React.useEffect(() => {
		if (!open) {
			setQuery("");
			setResults([]);
			setLoading(false);
			return;
		}
		if (query.trim().length < 2) {
			setResults([]);
			return;
		}

		setLoading(true);
		const id = window.setTimeout(async () => {
			const items = await fetchResults(query.trim());
			setResults(items);
			setLoading(false);
		}, 120);

		return () => {
			window.clearTimeout(id);
		};
	}, [open, query]);

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="hidden md:inline-flex xl:hidden"
				onClick={() => setOpen(true)}
			>
				<Search className="h-4 w-4" />
				<span className="sr-only">Search</span>
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="hidden xl:flex items-center gap-2"
				onClick={() => setOpen(true)}
			>
				<Search className="h-4 w-4" />
				<span>Search</span>
				<span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
					Ctrl/Cmd+K
				</span>
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="md:hidden"
				onClick={() => setOpen(true)}
			>
				<Search className="h-5 w-5" />
				<span className="sr-only">Search</span>
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							Global Search
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Input
							autoFocus
							value={query}
							onChange={(event) =>
								setQuery(event.target.value)
							}
							placeholder="Search customer, product, barcode, or transaction reference..."
						/>
						{query.trim().length < 2 ? (
							<p className="text-sm text-muted-foreground">
								Type at least 2 characters.
							</p>
						) : loading ? (
							<p className="text-sm text-muted-foreground">
								Searching...
							</p>
						) : results.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No matches found.
							</p>
						) : (
							<div className="max-h-[50vh] space-y-2 overflow-y-auto">
								{results.map((item) => (
									<button
										key={item.id}
										type="button"
										className="w-full rounded border p-3 text-left hover:bg-accent"
										onClick={() => {
											setOpen(false);
											router.push(item.href);
										}}
									>
										<p className="text-xs text-muted-foreground">
											{item.type}
										</p>
										<p className="font-medium">
											{item.title}
										</p>
										<p className="text-sm text-muted-foreground">
											{item.description}
										</p>
									</button>
								))}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
