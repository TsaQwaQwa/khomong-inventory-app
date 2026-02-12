export type ApiResponse<T> =
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			error: {
				message: string;
				code?: string;
			};
	  };

export async function jsonFetcher<T>(
	input: RequestInfo,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(input, init);
	const payload = (await res.json()) as ApiResponse<T>;

	if (!res.ok || !payload.ok) {
		throw new Error(
			payload.error?.message || "Failed to fetch data",
		);
	}

	return payload.data;
}
