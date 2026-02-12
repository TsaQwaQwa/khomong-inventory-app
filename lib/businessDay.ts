import { connectDB } from "@/lib/db";
import { todayYMD } from "@/lib/dates";
import { BusinessDay } from "@/models/BusinessDay";

export async function getOrCreateDay(
	date: string | undefined,
	userId: string,
) {
	await connectDB();
	const d = date ?? todayYMD();
	const existing = await BusinessDay.findOne({
		date: d,
	}).lean();
	if (existing) return existing;

	const created = await BusinessDay.create({
		date: d,
		status: "OPEN",
		openedByUserId: userId,
		openedAt: new Date(),
	});

	return created.toObject();
}
