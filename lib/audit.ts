import { AuditLog } from "@/models/AuditLog";

type Primitive =
	| string
	| number
	| boolean
	| null
	| undefined;

type JsonLike =
	| Primitive
	| JsonLike[]
	| { [key: string]: JsonLike };

interface AuthLike {
	userId?: string | null;
	orgId?: string | null;
}

interface WriteAuditArgs {
	scopeId: string;
	actorUserId?: string;
	action: string;
	entityType: string;
	entityId?: string;
	oldValues?: Record<string, unknown> | null;
	newValues?: Record<string, unknown> | null;
	meta?: Record<string, unknown>;
}

interface FieldChange {
	field: string;
	oldValue: unknown;
	newValue: unknown;
}

function safeClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeValue(value: unknown): JsonLike {
	if (value instanceof Date) return value.toISOString();
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null ||
		value === undefined
	) {
		return value as Primitive;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeValue(entry));
	}
	if (isObject(value)) {
		const out: Record<string, JsonLike> = {};
		for (const [key, entry] of Object.entries(value)) {
			if (key === "__v") continue;
			out[key] = normalizeValue(entry);
		}
		return out;
	}
	return String(value);
}

function areEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function collectChanges(
	oldValue: unknown,
	newValue: unknown,
	path: string,
	out: FieldChange[],
) {
	const oldNorm = normalizeValue(oldValue);
	const newNorm = normalizeValue(newValue);

	const oldObj = isObject(oldNorm);
	const newObj = isObject(newNorm);
	if (oldObj && newObj) {
		const keys = new Set([
			...Object.keys(oldNorm),
			...Object.keys(newNorm),
		]);
		for (const key of keys) {
			const nextPath = path ? `${path}.${key}` : key;
			collectChanges(
				(oldNorm as Record<string, unknown>)[key],
				(newNorm as Record<string, unknown>)[key],
				nextPath,
				out,
			);
		}
		return;
	}

	if (!areEqual(oldNorm, newNorm)) {
		out.push({
			field: path || "(root)",
			oldValue: oldNorm,
			newValue: newNorm,
		});
	}
}

export function getScopeIdFromAuth(a: AuthLike): string {
	return a.orgId ?? a.userId ?? "unknown_scope";
}

export function toAuditObject(
	value: unknown,
): Record<string, unknown> | null {
	if (!value || typeof value !== "object") return null;
	const normalized = normalizeValue(value);
	if (!isObject(normalized)) return null;
	return safeClone(normalized);
}

export async function writeAuditLog({
	scopeId,
	actorUserId,
	action,
	entityType,
	entityId,
	oldValues,
	newValues,
	meta,
}: WriteAuditArgs) {
	const oldObj = oldValues ?? null;
	const newObj = newValues ?? null;
	const fieldChanges: FieldChange[] = [];
	collectChanges(oldObj, newObj, "", fieldChanges);

	await AuditLog.create({
		scopeId,
		actorUserId,
		action,
		entityType,
		entityId,
		fieldChanges,
		oldValues: oldObj,
		newValues: newObj,
		meta,
	});
}

