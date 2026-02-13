import { PageWrapper } from "@/components/page-wrapper";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
	return (
		<PageWrapper
			title="About Kgomong"
			description="Business profile and operating context."
		>
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>
							Who We Are
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>
							Kgomong is a neighborhood
							tavern operation focused on
							fast service, reliable stock
							availability, and clear daily
							accountability.
						</p>
						<p>
							This system supports the
							team with product, pricing,
							stock, customer account, and
							reporting workflows in one place.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>
							Operating Priorities
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>
							1. Keep fast-moving products
							in stock.
						</p>
						<p>
							2. Capture all sales and
							purchases with minimal delay.
						</p>
						<p>
							3. Track margins, stock risk,
							and supplier costs over time.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>
							Business Scope
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>
							Inventory categories include
							beer, cider, spirits, wine,
							mixers, and snacks.
						</p>
						<p>
							Sales channels include direct
							payments and customer credit
							accounts.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>
							Contact & Ownership
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>
							Update this section with official
							business contact details, owner
							name, and operating hours.
						</p>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
