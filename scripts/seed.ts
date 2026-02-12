import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";

async function main() {
	await connectDB();

	const sample = [
		{
			name: "Castle Lite 330ml",
			category: "Beer",
			packSize: 24,
			reorderLevelUnits: 48,
		},
		{
			name: "Black Label 330ml",
			category: "Beer",
			packSize: 24,
			reorderLevelUnits: 48,
		},
		{
			name: "Savanna Dry 330ml",
			category: "Cider",
			packSize: 24,
			reorderLevelUnits: 24,
		},
		{
			name: "Sierra Weisse 330ml",
			category: "Cider",
			packSize: 24,
			reorderLevelUnits: 24,
		},
		{
			name: "Coca-Cola 300ml",
			category: "SoftDrink",
			packSize: 24,
			reorderLevelUnits: 12,
		},
		{
			name: "Stoney Ginger Beer 330ml",
			category: "SoftDrink",
			packSize: 12,
			reorderLevelUnits: 12,
		},
	] as const;

	for (const p of sample) {
		await Product.updateOne(
			{ name: p.name },
			{ $setOnInsert: { ...p, isActive: true } },
			{ upsert: true },
		);
	}

	console.log("Seeded sample products.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
