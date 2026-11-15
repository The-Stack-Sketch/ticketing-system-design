export const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

export function post(path: string, body: object, headers: Record<string, string> = {}) {
  return fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// Join the waiting room and wait until we're let in. Returns the signed pass.
export async function getPass(eventId = "42") {
  const { lineToken } = await (await post(`/events/${eventId}/line`, {})).json();
  while (true) {
    const s = await (await fetch(`${BASE}/events/${eventId}/line/status?token=${encodeURIComponent(lineToken)}`)).json();
    if (s.pass) return s.pass as string;
    if (s.error) throw new Error(s.error);
    await sleep(1000);
  }
}
