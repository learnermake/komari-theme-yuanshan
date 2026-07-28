export type ThemeMode = 'system' | 'light' | 'dark';
export type DesktopView = 'cards' | 'list';
export type SortMode = 'default' | 'name' | 'realtime' | 'traffic' | 'price';
export type BackgroundMode = 'auto' | 'image' | 'video';
export type CurrencyCode = 'CNY' | 'HKD' | 'USD' | 'EUR' | 'GBP';
export type Language = 'zh-CN' | 'en';

export interface ThemeSettings {
  appearance: ThemeMode;
  desktop_view: DesktopView;
  card_opacity: number;
  glass_enabled: boolean;
  desktop_background_url: string;
  desktop_background_mode: BackgroundMode;
  mobile_background_url: string;
  mobile_background_mode: BackgroundMode;
  data_update_interval: number;
  show_overview: boolean;
  overview_online: boolean;
  overview_realtime: boolean;
  overview_traffic: boolean;
  overview_asset: boolean;
  sort_mode: SortMode;
  show_traffic: boolean;
  show_load: boolean;
  show_latency: boolean;
  ratings_enabled: boolean;
  rating_labels: string;
  asset_value_enabled: boolean;
  visitor_asset_visible: boolean;
  target_currency: CurrencyCode;
  fallback_source_currency: CurrencyCode;
  exchange_api: string;
  site_logo: string;
  site_title: string;
  footer_enabled: boolean;
  footer_text: string;
}

export type RawThemeSettings = Record<string, unknown>;

export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export interface PublicInfo {
  sitename?: string;
  description?: string;
  theme?: string;
  theme_settings?: RawThemeSettings;
  record_enabled?: boolean;
  record_preserve_time?: number;
  ping_record_preserve_time?: number;
  private_site?: boolean;
}

export interface MeInfo {
  logged_in: boolean;
  username?: string;
  uuid?: string;
}

export interface NodeInfo {
  uuid: string;
  name: string;
  cpu_name?: string;
  virtualization?: string;
  arch?: string;
  cpu_cores?: number;
  cpu_physical_cores?: number;
  os?: string;
  kernel_version?: string;
  gpu_name?: string;
  region?: string;
  mem_total?: number;
  swap_total?: number;
  disk_total?: number;
  weight?: number;
  price?: number;
  billing_cycle?: number;
  auto_renewal?: boolean;
  currency?: string;
  expired_at?: string | null;
  group?: string;
  tags?: string;
  public_remark?: string;
  hidden?: boolean;
  traffic_limit?: number;
  traffic_limit_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RealtimeStatus {
  cpu?: { usage?: number };
  ram?: { total?: number; used?: number };
  swap?: { total?: number; used?: number };
  load?: { load1?: number; load5?: number; load15?: number };
  disk?: { total?: number; used?: number };
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number };
  connections?: { tcp?: number; udp?: number };
  uptime?: number;
  process?: number;
  message?: string;
  updated_at?: string;
}

export interface LiveRuntime {
  uuid: string;
  online: boolean;
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  swapUsed: number;
  swapTotal: number;
  diskUsed: number;
  diskTotal: number;
  netUp: number;
  netDown: number;
  totalUp: number;
  totalDown: number;
  uptime: number;
  load1: number;
  load5: number;
  load15: number;
  tcp: number;
  udp: number;
  process: number;
  updatedAt?: string;
  message?: string;
}

export interface LiveSocketResponse {
  status?: string;
  data?: {
    online?: string[];
    data?: Record<string, RealtimeStatus>;
  };
}

export interface FlatStatusRecord {
  client?: string;
  time?: string;
  cpu?: number;
  gpu?: number;
  ram?: number;
  ram_total?: number;
  swap?: number;
  swap_total?: number;
  load?: number;
  load5?: number;
  load15?: number;
  temp?: number;
  disk?: number;
  disk_total?: number;
  net_in?: number;
  net_out?: number;
  net_total_up?: number;
  net_total_down?: number;
  uptime?: number;
  process?: number;
  connections?: number;
  connections_udp?: number;
}

export interface LoadRecordResponse {
  count?: number;
  records?: FlatStatusRecord[];
  has_gpu_data?: boolean;
}

export interface RecentRecordResponse {
  count?: number;
  records?: FlatStatusRecord[];
}

export interface LegacyRecentRecord {
  cpu?: { usage?: number };
  ram?: { total?: number; used?: number };
  disk?: { total?: number; used?: number };
  load?: { load1?: number; load5?: number; load15?: number };
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number };
  connections?: { tcp?: number; udp?: number };
  uptime?: number;
  process?: number;
  updated_at?: string;
}

export interface PingTask {
  id: number;
  name: string;
  type?: string;
  interval?: number;
  default_on?: boolean;
  clients?: string[];
}

export interface PingRecord {
  task_id: number;
  time: string;
  value: number;
  client?: string;
}

export interface PingRecordResponse {
  count?: number;
  records?: PingRecord[];
  tasks?: PingTask[];
  basic_info?: Array<{ client: string; loss: number; min: number; max: number }>;
}

export interface RateTable {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>;
  date?: string;
}

export interface AssetNodeValue {
  total: number;
  remaining: number;
  sourceCurrency: CurrencyCode;
  sourcePrice: number;
  valid: boolean;
}

export interface AssetStats {
  total: number;
  remaining: number;
  byNode: Record<string, AssetNodeValue>;
}
