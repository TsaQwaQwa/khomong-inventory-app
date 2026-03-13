export async function readOfflineResource<T>(
	key: string,
	maxAgeMs?: number,
) {
	void key;
	void maxAgeMs;
	return null as
		| {
				value: T;
				updatedAt: number;
				isExpired: boolean;
		  }
		| null;
}

export async function writeOfflineResource<T>(
	key: string,
	value: T,
) {
	void key;
	void value;
}
