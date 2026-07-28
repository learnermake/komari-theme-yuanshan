import type { BackgroundMode, CurrencyCode, DesktopView, RawThemeSettings, SortMode, ThemeMode, ThemeSettings } from './types';

export const DEFAULT_EXCHANGE_API = 'https://api.frankfurter.dev/v2/rates?base=USD';

export const DEFAULT_SETTINGS: ThemeSettings = {
  appearance: 'system',
  desktop_view: 'cards',
  card_opacity: 88,
  glass_enabled: true,
  desktop_background_url: '',
  desktop_background_mode: 'auto',
  mobile_background_url: '',
  mobile_background_mode: 'auto',
  data_update_interval: 5,
  show_overview: true,
  overview_online: true,
  overview_realtime: true,
  overview_traffic: true,
  overview_asset: true,
  sort_mode: 'default',
  show_traffic: false,
  show_load: false,
  show_latency: false,
  ratings_enabled: true,
  rating_labels: 'Quiet,Normal,Active,Peak',
  asset_value_enabled: true,
  visitor_asset_visible: false,
  target_currency: 'CNY',
  fallback_source_currency: 'USD',
  exchange_api: DEFAULT_EXCHANGE_API,
  site_logo: '',
  site_title: '',
  footer_enabled: true,
  footer_text: 'Powered by Komari · Theme by shan',
};

const themeModes = ['system', 'light', 'dark'] as const;
const desktopViews = ['cards', 'list'] as const;
const backgroundModes = ['auto', 'image', 'video'] as const;
const sortModes = ['default', 'name', 'realtime', 'traffic', 'price'] as const;
const currencies = ['CNY', 'HKD', 'USD', 'EUR', 'GBP'] as const;

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function asNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max ?? parsed, Math.max(min ?? parsed, parsed));
}

export function normalizeSettings(raw: RawThemeSettings | undefined | null): ThemeSettings {
  const source = raw ?? {};
  return {
    appearance: isOneOf(source.appearance, themeModes) ? (source.appearance as ThemeMode) : DEFAULT_SETTINGS.appearance,
    desktop_view: isOneOf(source.desktop_view, desktopViews) ? (source.desktop_view as DesktopView) : DEFAULT_SETTINGS.desktop_view,
    card_opacity: asNumber(source.card_opacity, DEFAULT_SETTINGS.card_opacity, 45, 100),
    glass_enabled: asBool(source.glass_enabled, DEFAULT_SETTINGS.glass_enabled),
    desktop_background_url: asString(source.desktop_background_url, DEFAULT_SETTINGS.desktop_background_url),
    desktop_background_mode: isOneOf(source.desktop_background_mode, backgroundModes)
      ? (source.desktop_background_mode as BackgroundMode)
      : DEFAULT_SETTINGS.desktop_background_mode,
    mobile_background_url: asString(source.mobile_background_url, DEFAULT_SETTINGS.mobile_background_url),
    mobile_background_mode: isOneOf(source.mobile_background_mode, backgroundModes)
      ? (source.mobile_background_mode as BackgroundMode)
      : DEFAULT_SETTINGS.mobile_background_mode,
    data_update_interval: asNumber(source.data_update_interval, DEFAULT_SETTINGS.data_update_interval, 1, 300),
    show_overview: asBool(source.show_overview, DEFAULT_SETTINGS.show_overview),
    overview_online: asBool(source.overview_online, DEFAULT_SETTINGS.overview_online),
    overview_realtime: asBool(source.overview_realtime, DEFAULT_SETTINGS.overview_realtime),
    overview_traffic: asBool(source.overview_traffic, DEFAULT_SETTINGS.overview_traffic),
    overview_asset: asBool(source.overview_asset, DEFAULT_SETTINGS.overview_asset),
    sort_mode: isOneOf(source.sort_mode, sortModes) ? (source.sort_mode as SortMode) : DEFAULT_SETTINGS.sort_mode,
    show_traffic: asBool(source.show_traffic, DEFAULT_SETTINGS.show_traffic),
    show_load: asBool(source.show_load, DEFAULT_SETTINGS.show_load),
    show_latency: asBool(source.show_latency, DEFAULT_SETTINGS.show_latency),
    ratings_enabled: asBool(source.ratings_enabled, DEFAULT_SETTINGS.ratings_enabled),
    rating_labels: asString(source.rating_labels, DEFAULT_SETTINGS.rating_labels),
    asset_value_enabled: asBool(source.asset_value_enabled, DEFAULT_SETTINGS.asset_value_enabled),
    visitor_asset_visible: asBool(source.visitor_asset_visible, DEFAULT_SETTINGS.visitor_asset_visible),
    target_currency: isOneOf(source.target_currency, currencies) ? (source.target_currency as CurrencyCode) : DEFAULT_SETTINGS.target_currency,
    fallback_source_currency: isOneOf(source.fallback_source_currency, currencies)
      ? (source.fallback_source_currency as CurrencyCode)
      : DEFAULT_SETTINGS.fallback_source_currency,
    exchange_api: asString(source.exchange_api, DEFAULT_SETTINGS.exchange_api),
    site_logo: asString(source.site_logo, DEFAULT_SETTINGS.site_logo),
    site_title: asString(source.site_title, DEFAULT_SETTINGS.site_title),
    footer_enabled: asBool(source.footer_enabled, DEFAULT_SETTINGS.footer_enabled),
    footer_text: asString(source.footer_text, DEFAULT_SETTINGS.footer_text),
  };
}

export function serializeSettings(settings: ThemeSettings): RawThemeSettings {
  return { ...settings };
}

export function getRatingLabels(settings: ThemeSettings): string[] {
  const labels = settings.rating_labels
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallback = DEFAULT_SETTINGS.rating_labels.split(',');
  while (labels.length < 4) labels.push(fallback[labels.length]);
  return labels;
}
