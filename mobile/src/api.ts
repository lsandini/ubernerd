import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function getApiBase(): string {
  if (Platform.OS === 'web') {
    return 'http://localhost:8787';
  }
  // In Expo Go on a physical device, localhost means the device itself.
  // Extract the dev machine's LAN IP from the Expo dev server connection.
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? '';
  const lanIp = debuggerHost.split(':')[0];
  if (lanIp) {
    return `http://${lanIp}:8787`;
  }
  return 'http://localhost:8787';
}

const API_BASE = getApiBase();

export async function getConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`config ${res.status}`);
  return res.json();
}

export interface LadderEntry {
  rank: number;
  uuid: string;
  score: number;
  avgRtMs: number;
  numAttempts: number;
}

export interface LadderResponse {
  periodStart: number;
  entries: LadderEntry[];
  source: 'materialized' | 'live';
}

export async function getLadder(params: {
  domain?: string;
  period?: 'day' | 'week' | 'month' | 'all';
}): Promise<LadderResponse> {
  const url = new URL(`${API_BASE}/ladder`);
  url.searchParams.set('domain', params.domain ?? 'medical');
  url.searchParams.set('period', params.period ?? 'week');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ladder ${res.status}`);
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
