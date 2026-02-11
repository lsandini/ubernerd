const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8787';

export async function getConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`config ${res.status}`);
  return res.json();
}

export async function getPacks(params: { domain: string; locale: string; sinceEtag?: string }) {
  const url = new URL(`${API_BASE}/packs`);
  url.searchParams.set('domain', params.domain);
  url.searchParams.set('locale', params.locale);
  if (params.sinceEtag) url.searchParams.set('sinceEtag', params.sinceEtag);
  const res = await fetch(url.toString(), {
    headers: { 'If-None-Match': params.sinceEtag || '' },
  });
  if (res.status === 304) return { etag: params.sinceEtag, packs: [], nextCheckSec: 21600 };
  if (!res.ok) throw new Error(`packs ${res.status}`);
  return res.json();
}
