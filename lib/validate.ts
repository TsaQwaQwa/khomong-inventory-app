import { ZodError, type ZodSchema } from 'zod';

export async function parseJson<T>(
	req: Request,
	schema: ZodSchema<T>,
): Promise<T> {
  const body = await req.json().catch(() => null);
  if (!body) throw new Error('INVALID_JSON');
  try {
    return schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const msg = e.issues
			.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
			.join('; ');
      // throw to be handled upstream; callers can convert to response
      throw new Error(`VALIDATION_ERROR:${msg}`);
    }
    throw e;
  }
}
