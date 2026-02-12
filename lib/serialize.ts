import { Types } from "mongoose";

type DocumentLike = {
	_id?: Types.ObjectId | string | null;
	__v?: unknown;
};

export function serializeDoc<T extends DocumentLike>(doc: T) {
	if (!doc) return null;
	const { _id, __v, ...rest } = doc as any;
	const id =
		typeof _id === "string"
			? _id
			: _id && typeof _id.toString === "function"
			? _id.toString()
			: undefined;

	return {
		...rest,
		id,
	};
}

export function serializeDocs<T extends DocumentLike>(docs: T[]) {
	return docs.map((doc) => serializeDoc(doc));
}
