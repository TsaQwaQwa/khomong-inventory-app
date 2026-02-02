import { NextResponse } from 'next/server';

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, init?: ResponseInit & { code?: string }) {
  const status = init?.status ?? 400;
  const code = init?.code ?? 'BAD_REQUEST';
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
