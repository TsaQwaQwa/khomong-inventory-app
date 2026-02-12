import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
	return (
		<div className="container px-4 py-12 max-w-xl">
			<h1 className="text-2xl font-bold mb-2">
				Access blocked
			</h1>
			<p className="text-muted-foreground mb-6">
				Your account is not on the approved user
				list for this business system.
			</p>
			<div className="flex gap-3">
				<Button asChild>
					<Link href="/dashboard">
						Try again
					</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href="/sign-in">
						Sign in with another account
					</Link>
				</Button>
			</div>
		</div>
	);
}
