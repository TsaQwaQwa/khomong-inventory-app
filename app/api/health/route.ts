export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ ok: true, name: 'tavern-monitor-starter', ts: new Date().toISOString() });
}
