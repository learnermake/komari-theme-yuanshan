import type {
  ApiResponse,
  FlatStatusRecord,
  LegacyRecentRecord,
  LoadRecordResponse,
  MeInfo,
  NodeInfo,
  PingRecord,
  PingRecordResponse,
  PingTask,
  PublicInfo,
  RateTable,
  RawThemeSettings,
  RecentRecordResponse
} from './types';

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'status' in payload && 'data' in payload) {
    const response = payload as ApiResponse<T>;
    if (response.status && response.status !== 'success') throw new Error(response.message || response.status);
    return response.data;
  }
  return payload as T;
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return unwrapData<T>(await response.json());
}

export function getPublicInfo(): Promise<PublicInfo> {
  return requestData<PublicInfo>('/api/public');
}

export function getMe(): Promise<MeInfo> {
  return requestData<MeInfo>('/api/me').catch(() => ({ logged_in: false }));
}

export async function getNodes(): Promise<NodeInfo[]> {
  const data = await requestData<NodeInfo[] | Record<string, NodeInfo>>('/api/nodes');
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.values(data);
  return [];
}

export async function getRecentRecords(uuid: string): Promise<FlatStatusRecord[]> {
  const result = await rpc<{ count: number; records: Array<{
    time: string; cpu?: number; ram?: number; ram_total?: number; swap?: number; swap_total?: number;
    disk?: number; disk_total?: number; load?: number; load5?: number; load15?: number;
    net_in?: number; net_out?: number; net_total_up?: number; net_total_down?: number;
    process?: number; connections?: number; connections_udp?: number; uptime?: number;
  }> }>('common:getNodeRecentStatus', { uuid });
  return (result?.records ?? []).map((r) => ({
    time: r.time, cpu: r.cpu ?? 0, ram: r.ram ?? 0, ram_total: r.ram_total ?? 0,
    swap: r.swap ?? 0, swap_total: r.swap_total ?? 0, disk: r.disk ?? 0, disk_total: r.disk_total ?? 0,
    load: r.load ?? 0, load5: r.load5 ?? 0, load15: r.load15 ?? 0,
    net_in: r.net_in ?? 0, net_out: r.net_out ?? 0, net_total_up: r.net_total_up ?? 0, net_total_down: r.net_total_down ?? 0,
    uptime: r.uptime, process: r.process, connections: r.connections ?? 0, connections_udp: r.connections_udp ?? 0
  }));
}

export async function getLoadRecords(uuid: string, hours: number): Promise<LoadRecordResponse> {
  const result = await rpc<{ count: number; records: Record<string, FlatStatusRecord[]> }>('common:getRecords', { type: 'load', uuid, hours, load_type: 'all', maxCount: 4000 });
  return { records: result?.records?.[uuid] ?? [] };
}

export async function getPingRecords(uuid: string, hours: number): Promise<PingRecordResponse> {
  const result = await rpc<{ count: number; records: PingRecord[]; tasks?: PingTask[] }>('public:getPingRecords', { uuid, hours: String(hours) });
  return { records: result?.records ?? [], tasks: result?.tasks ?? [] };
}

let rpcId = 1;

export async function rpc<T>(method: string, params?: unknown): Promise<T> {
  const id = rpcId++;
  const response = await fetch('/api/rpc2', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { result?: T; error?: { message?: string; code?: number } };
  if (payload.error) throw new Error(payload.error.message || `RPC error ${payload.error.code ?? ''}`.trim());
  return payload.result as T;
}

export async function saveThemeSettings(settings: RawThemeSettings): Promise<void> {
  const response = await fetch('/api/admin/theme/settings?theme=yuanshan', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  unwrapData<null>(await response.json());
}

export async function getExchangeRates(url: string): Promise<RateTable | null> {
  if (!url.trim()) return null;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { base?: string; rates?: Record<string, number>; date?: string };
  if (!payload.base || !payload.rates) throw new Error('Invalid exchange response');
  return {
    base: payload.base.toUpperCase() as RateTable['base'],
    rates: Object.fromEntries(Object.entries(payload.rates).map(([key, value]) => [key.toUpperCase(), value])),
    date: payload.date
  };
}
