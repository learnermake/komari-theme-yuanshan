import type { AssetStats, CurrencyCode, FlatStatusRecord, LiveRuntime, NodeInfo, RateTable, RealtimeStatus, ThemeSettings } from './types';
import { getRatingLabels } from './config';

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const staticPerUsd: Record<CurrencyCode, number> = {
  USD: 1,
  CNY: 7.2,
  HKD: 7.82,
  EUR: 0.92,
  GBP: 0.78
};

const currencySymbols: Record<CurrencyCode, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

export function classNames(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(' ');
}

export function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function percent(used?: number, total?: number): number {
  if (!used || !total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function formatBytes(bytes?: number, precision = 1): string {
  let value = Math.max(0, safeNumber(bytes));
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < byteUnits.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : precision;
  return `${value.toFixed(digits)} ${byteUnits[unitIndex]}`;
}

export function formatSpeed(bytesPerSecond?: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatPercent(value?: number): string {
  return `${safeNumber(value).toFixed(0)}%`;
}

export function formatLoad(value?: number): string {
  return safeNumber(value).toFixed(2);
}

export function formatUptime(seconds?: number): string {
  const value = Math.max(0, Math.floor(safeNumber(seconds)));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function shortOs(os?: string): string {
  if (!os) return '-';
  const value = os.toLowerCase();
  if (value.includes('debian')) return 'Debian';
  if (value.includes('ubuntu')) return 'Ubuntu';
  if (value.includes('centos')) return 'CentOS';
  if (value.includes('almalinux')) return 'AlmaLinux';
  if (value.includes('rocky')) return 'Rocky';
  if (value.includes('windows')) return 'Windows';
  if (value.includes('arch')) return 'Arch';
  if (value.includes('fedora')) return 'Fedora';
  return os.split(/[,(]/)[0]?.trim() || os;
}

export function createRuntime(uuid: string, status: RealtimeStatus | undefined, online: boolean): LiveRuntime {
  return {
    uuid,
    online,
    cpu: safeNumber(status?.cpu?.usage),
    ramUsed: safeNumber(status?.ram?.used),
    ramTotal: safeNumber(status?.ram?.total),
    swapUsed: safeNumber(status?.swap?.used),
    swapTotal: safeNumber(status?.swap?.total),
    diskUsed: safeNumber(status?.disk?.used),
    diskTotal: safeNumber(status?.disk?.total),
    netUp: safeNumber(status?.network?.up),
    netDown: safeNumber(status?.network?.down),
    totalUp: safeNumber(status?.network?.totalUp),
    totalDown: safeNumber(status?.network?.totalDown),
    uptime: safeNumber(status?.uptime),
    load1: safeNumber(status?.load?.load1),
    load5: safeNumber(status?.load?.load5),
    load15: safeNumber(status?.load?.load15),
    tcp: safeNumber(status?.connections?.tcp),
    udp: safeNumber(status?.connections?.udp),
    process: safeNumber(status?.process),
    updatedAt: status?.updated_at,
    message: status?.message
  };
}

export function runtimeFromFlat(uuid: string, record: FlatStatusRecord | undefined, online = true): LiveRuntime {
  return {
    uuid,
    online,
    cpu: safeNumber(record?.cpu),
    ramUsed: safeNumber(record?.ram),
    ramTotal: safeNumber(record?.ram_total),
    swapUsed: safeNumber(record?.swap),
    swapTotal: safeNumber(record?.swap_total),
    diskUsed: safeNumber(record?.disk),
    diskTotal: safeNumber(record?.disk_total),
    netUp: safeNumber(record?.net_out),
    netDown: safeNumber(record?.net_in),
    totalUp: safeNumber(record?.net_total_up),
    totalDown: safeNumber(record?.net_total_down),
    uptime: 0,
    load1: safeNumber(record?.load),
    load5: safeNumber(record?.load5),
    load15: safeNumber(record?.load15),
    tcp: safeNumber(record?.connections),
    udp: safeNumber(record?.connections_udp),
    process: safeNumber(record?.process),
    updatedAt: record?.time
  };
}

export function parseCurrency(input: string | undefined, fallback: CurrencyCode): CurrencyCode {
  const value = (input || '').trim().toUpperCase();
  if (!value) return fallback;
  if (value.includes('HK') || value === '港币') return 'HKD';
  if (value.includes('CNY') || value.includes('RMB') || value.includes('CN¥') || value.includes('￥') || value === '¥' || value === '人民币') return 'CNY';
  if (value.includes('EUR') || value.includes('€')) return 'EUR';
  if (value.includes('GBP') || value.includes('£')) return 'GBP';
  if (value.includes('USD') || value.includes('US$') || value === '$') return 'USD';
  return fallback;
}

function convertStatic(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  return (amount / staticPerUsd[from]) * staticPerUsd[to];
}

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode, rateTable: RateTable | null): number {
  if (from === to) return amount;
  if (!rateTable) return convertStatic(amount, from, to);
  const base = rateTable.base;
  const rates = { ...rateTable.rates, [base]: 1 } as Partial<Record<CurrencyCode, number>>;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return convertStatic(amount, from, to);
  const baseAmount = from === base ? amount : amount / fromRate;
  return to === base ? baseAmount : baseAmount * toRate;
}

export function formatMoney(value: number, currency: CurrencyCode): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : 2;
  return `${currencySymbols[currency]}${value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}`;
}

export function calculateAssetStats(nodes: NodeInfo[], settings: ThemeSettings, rateTable: RateTable | null): AssetStats {
  if (!settings.asset_value_enabled) return { total: 0, remaining: 0, byNode: {} };
  const byNode: AssetStats['byNode'] = {};
  let total = 0;
  let remaining = 0;
  const now = Date.now();
  for (const node of nodes) {
    const sourcePrice = safeNumber(node.price, -1);
    const sourceCurrency = parseCurrency(node.currency, settings.fallback_source_currency);
    if (sourcePrice <= 0) {
      byNode[node.uuid] = { total: 0, remaining: 0, sourceCurrency, sourcePrice, valid: false };
      continue;
    }
    const converted = convertCurrency(sourcePrice, sourceCurrency, settings.target_currency, rateTable);
    const cycle = safeNumber(node.billing_cycle, 0);
    const expiry = node.expired_at ? Date.parse(node.expired_at) : NaN;
    const isLongTerm = cycle === 0 || (!Number.isFinite(expiry)) || (Number.isFinite(expiry) && (expiry - now) / 86400000 > 36500);
    let remainingRatio: number;
    if (isLongTerm) {
      remainingRatio = 1;
    } else if (Number.isFinite(expiry) && cycle > 0) {
      remainingRatio = Math.min(1, Math.max(0, (expiry - now) / 86400000 / cycle));
    } else {
      remainingRatio = 0;
    }
    const nodeRemaining = converted * remainingRatio;
    total += converted;
    remaining += nodeRemaining;
    byNode[node.uuid] = { total: converted, remaining: nodeRemaining, sourceCurrency, sourcePrice, valid: true };
  }
  return { total, remaining, byNode };
}

export function getOverviewRating(kind: 'traffic' | 'speed' | 'asset', value: number, settings: ThemeSettings, rateTable: RateTable | null): string {
  const labels = getRatingLabels(settings);
  if (!settings.ratings_enabled) return '';
  if (kind === 'traffic') {
    if (value < 100 * 1024 ** 3) return labels[0];
    if (value < 1024 ** 4) return labels[1];
    if (value < 10 * 1024 ** 4) return labels[2];
    return labels[3];
  }
  if (kind === 'speed') {
    if (value < 1024 ** 2) return labels[0];
    if (value < 10 * 1024 ** 2) return labels[1];
    if (value < 50 * 1024 ** 2) return labels[2];
    return labels[3];
  }
  const cnyThresholds = [100, 1000, 5000].map((amount) => convertCurrency(amount, 'CNY', settings.target_currency, rateTable));
  if (value < cnyThresholds[0]) return labels[0];
  if (value < cnyThresholds[1]) return labels[1];
  if (value < cnyThresholds[2]) return labels[2];
  return labels[3];
}

export function latestRecord(records: FlatStatusRecord[]): FlatStatusRecord | undefined {
  return records[records.length - 1];
}

export function resolveTrafficUsage(limitType: string | undefined, up: number, down: number, limit: number): { used: number; fraction: number } {
  if (!limit || limit <= 0) return { used: up + down, fraction: 0 };
  const type = (limitType || 'sum').toLowerCase();
  let used = up + down;
  if (type === 'up') used = up;
  else if (type === 'down') used = down;
  else if (type === 'max') used = Math.max(up, down);
  else if (type === 'min') used = Math.min(up, down);
  return { used, fraction: Math.min(1, used / limit) };
}

export function addRandomQuery(url: string, token: string): string {
  if (!url || url.startsWith('data:')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}yuanshan_random=${encodeURIComponent(token)}`;
}
