import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Gauge,
  HardDrive,
  LayoutGrid,
  Monitor,
  Moon,
  Save,
  Server,
  Settings as SettingsIcon,
  Sliders,
  Sun,
  Terminal,
  Upload,
  Wifi,
  X
} from 'lucide-react';
import { EChart } from './EChart';
import { getCountryCode, getDisplayRegionCode } from './flags';
import { DEFAULT_SETTINGS, normalizeSettings, serializeSettings } from './config';
import { createTranslator, useLanguage, type MessageKey } from './i18n';
import {
  getExchangeRates,
  getLoadRecords,
  getMe,
  getNodes,
  getPingRecords,
  getPublicInfo,
  getRecentRecords,
  saveThemeSettings
} from './api';
import type {
  AssetStats,
  CurrencyCode,
  FlatStatusRecord,
  LiveRuntime,
  LiveSocketResponse,
  MeInfo,
  NodeInfo,
  PingRecord,
  PingRecordResponse,
  PublicInfo,
  RateTable,
  RawThemeSettings,
  SortMode,
  ThemeSettings
} from './types';
import {
  addRandomQuery,
  calculateAssetStats,
  classNames,
  createRuntime,
  formatBytes,
  formatLoad,
  formatMoney,
  formatPercent,
  formatSpeed,
  formatUptime,
  getOverviewRating,
  latestRecord,
  percent,
  resolveTrafficUsage,
  runtimeFromFlat,
  safeNumber
} from './utils';

type Translator = ReturnType<typeof createTranslator>;
type Route = { name: 'home' } | { name: 'node'; uuid: string };
type LoadPeriod = 'realtime' | '4h' | '1d' | '7d' | '30d';
type PingPeriod = '1h' | '6h' | '12h' | '1d';

const loadPeriods: Array<{ key: LoadPeriod; label: MessageKey; hours: number }> = [
  { key: 'realtime', label: 'realtime', hours: 0 },
  { key: '4h', label: 'fourHours', hours: 4 },
  { key: '1d', label: 'oneDay', hours: 24 },
  { key: '7d', label: 'sevenDays', hours: 168 },
  { key: '30d', label: 'thirtyDays', hours: 720 }
];

const pingPeriods: Array<{ key: PingPeriod; label: MessageKey; hours: number }> = [
  { key: '1h', label: 'oneHour', hours: 1 },
  { key: '6h', label: 'sixHours', hours: 6 },
  { key: '12h', label: 'twelveHours', hours: 12 },
  { key: '1d', label: 'oneDay', hours: 24 }
];

const OS_IMAGES: Record<string, string> = {
  alma: '/assets/os-logo/os-alma.svg',
  alpine: '/assets/os-logo/os-alpine.webp',
  arch: '/assets/os-logo/os-arch.svg',
  armbian: '/assets/os-logo/os-armbian.svg',
  centos: '/assets/os-logo/os-centos.svg',
  debian: '/assets/os-logo/os-debian.svg',
  fedora: '/assets/os-logo/os-fedora.svg',
  freebsd: '/assets/os-logo/os-freebsd.svg',
  gentoo: '/assets/os-logo/os-gentoo.svg',
  kali: '/assets/os-logo/os-kail.svg',
  macos: '/assets/os-logo/os-macos.svg',
  manjaro: '/assets/os-logo/os-manjaro-.svg',
  mint: '/assets/os-logo/os-mint.svg',
  nixos: '/assets/os-logo/os-nix.svg',
  opensuse: '/assets/os-logo/os-openSUSE.svg',
  openwrt: '/assets/os-logo/os-openwrt.svg',
  proxmox: '/assets/os-logo/os-proxmox.ico',
  redhat: '/assets/os-logo/os-redhat.svg',
  rocky: '/assets/os-logo/os-rocky.svg',
  ubuntu: '/assets/os-logo/os-ubuntu.svg',
  windows: '/assets/os-logo/os-windows.svg',
  synology: '/assets/os-logo/os-synology.ico',
  fnos: '/assets/os-logo/os-fnos.ico',
  unraid: '/assets/os-logo/os-unraid.svg',
  istore: '/assets/os-logo/os-istore.png',
  qts: '/assets/os-logo/os-qnap.svg',
  huawei: '/assets/os-logo/os-huawei.svg',
  opencloud: '/assets/os-logo/os-OpenCloudOS.png',
};

const OS_KEYWORDS: Record<string, string[]> = {
  alma: ['alma', 'almalinux'],
  alpine: ['alpine'],
  arch: ['arch'],
  armbian: ['armbian'],
  centos: ['centos'],
  debian: ['debian', 'deb'],
  fedora: ['fedora'],
  freebsd: ['freebsd', 'bsd'],
  gentoo: ['gentoo'],
  kali: ['kali', 'kail'],
  macos: ['macos', 'darwin', 'osx'],
  manjaro: ['manjaro'],
  mint: ['mint'],
  nixos: ['nixos'],
  opensuse: ['opensuse', 'suse'],
  openwrt: ['openwrt', 'qwrt', 'immortalwrt'],
  proxmox: ['proxmox'],
  redhat: ['redhat', 'rhel'],
  rocky: ['rocky'],
  ubuntu: ['ubuntu', 'elementary'],
  windows: ['windows', 'win'],
  synology: ['synology', 'dsm'],
  fnos: ['fnos'],
  unraid: ['unraid'],
  istore: ['istore', 'istoreos'],
  qts: ['qts', 'qnap'],
  huawei: ['huawei', 'euleros'],
  opencloud: ['opencloud'],
};

function parseRoute(): Route {
  const match = window.location.pathname.match(/\/(?:node|instance)\/([^/?#]+)/);
  return match?.[1] ? { name: 'node', uuid: decodeURIComponent(match[1]) } : { name: 'home' };
}

function basePath(): string {
  for (const marker of ['/instance/', '/node/']) {
    const index = window.location.pathname.toLowerCase().indexOf(marker);
    if (index >= 0) return window.location.pathname.slice(0, index + 1) || '/';
  }
  return window.location.pathname.endsWith('/') ? window.location.pathname : '/';
}

function nodePath(uuid: string): string {
  const root = basePath().replace(/\/$/, '');
  return `${root}/instance/${encodeURIComponent(uuid)}`;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function App() {
  const language = useLanguage();
  const t = createTranslator(language);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [rawSettings, setRawSettings] = useState<RawThemeSettings>({});
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [me, setMe] = useState<MeInfo>({ logged_in: false });
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [runtime, setRuntime] = useState<Record<string, LiveRuntime>>({});
  const [liveReady, setLiveReady] = useState(false);
  const [rateTable, setRateTable] = useState<RateTable | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [dataReady, setDataReady] = useState(false);

  const isMobile = useMediaQuery('(max-width: 720px)');
  const assets = useMemo(() => calculateAssetStats(nodes, settings, rateTable), [nodes, settings, rateTable]);
  const canShowAssets = settings.asset_value_enabled && (me.logged_in || settings.visitor_asset_visible);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let publicData, nodeData, meData;
        const pd = (window as unknown as Record<string, unknown>).__PD__;
        if (pd && typeof pd === 'object' && typeof (pd as Promise<unknown>).then === 'function') {
          const resolved = await pd as [PublicInfo, NodeInfo[], MeInfo];
          if (cancelled) return;
          [publicData, nodeData, meData] = resolved;
        } else if (Array.isArray(pd)) {
          [publicData, nodeData, meData] = pd as [PublicInfo, NodeInfo[], MeInfo];
        } else {
          [publicData, nodeData, meData] = await Promise.all([getPublicInfo(), getNodes(), getMe()]);
        }
        if (cancelled) return;
        const themeSettings = (publicData as Record<string, unknown>)?.theme_settings ?? {};
        setPublicInfo(publicData as PublicInfo);
        setRawSettings(themeSettings as RawThemeSettings);
        setSettings(normalizeSettings(themeSettings as RawThemeSettings));
        setNodes(nodeData as NodeInfo[]);
        setMe(meData as MeInfo);
        setDataReady(true);
      } catch (error) {
        if (!cancelled) setLoadingError(error instanceof Error ? error.message : String(error));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getExchangeRates(settings.exchange_api)
      .then((rates) => { if (!cancelled) setRateTable(rates); })
      .catch(() => { if (!cancelled) setRateTable(null); });
    return () => { cancelled = true; };
  }, [settings.exchange_api]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = settings.appearance === 'system' ? (media.matches ? 'dark' : 'light') : settings.appearance;
      setResolvedTheme(resolved);
      document.documentElement.dataset.theme = resolved;
      localStorage.setItem('appearance', settings.appearance);
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.appearance]);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-alpha', String(settings.card_opacity / 100));
    document.documentElement.style.setProperty('--glass-blur', settings.glass_enabled ? '18px' : '0px');
    document.documentElement.style.setProperty('--glass-saturate', settings.glass_enabled ? '1.18' : '1');
  }, [settings.card_opacity, settings.glass_enabled]);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let intervalId = 0;
    let reconnectId = 0;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/clients`;
    const intervalMs = Math.max(1000, Math.min(60000, settings.data_update_interval * 1000));

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        socket?.send('get');
        intervalId = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('get');
        }, intervalMs);
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as LiveSocketResponse;
          const onlineSet = new Set(payload.data?.online ?? []);
          const data = payload.data?.data ?? {};
          setRuntime((previous) => {
            const next = { ...previous };
            for (const [uuid, status] of Object.entries(data)) {
              next[uuid] = createRuntime(uuid, status, onlineSet.has(uuid));
            }
            if (payload.data?.online) {
              for (const uuid of Object.keys(next)) {
                if (!onlineSet.has(uuid)) next[uuid] = { ...next[uuid], online: false };
              }
            }
            return next;
          });
          setLiveReady(true);
        } catch {
          setLiveReady(true);
        }
      };
      socket.onclose = () => {
        window.clearInterval(intervalId);
        if (!closed) reconnectId = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => setLiveReady(true);
    };

    connect();
    return () => {
      closed = true;
      window.clearInterval(intervalId);
      window.clearTimeout(reconnectId);
      socket?.close();
    };
  }, [settings.data_update_interval]);

  function navigate(next: Route) {
    const path = next.name === 'home' ? basePath() : nodePath(next.uuid);
    window.history.pushState(null, '', path);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveSettings(draft: ThemeSettings) {
    setSaveMessage(t('saving'));
    const nextRaw = { ...rawSettings, ...serializeSettings(draft) };
    try {
      await saveThemeSettings(nextRaw);
      setRawSettings(nextRaw);
      setSettings(normalizeSettings(nextRaw));
      getPublicInfo().then((refreshed) => setPublicInfo(refreshed)).catch(() => undefined);
      setSaveMessage(t('saved'));
    } catch (error) {
      setSaveMessage(`${t('saveFailed')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <>
      <Background settings={settings} isMobile={isMobile} />
      {dataReady && liveReady ? (
        <div className="app-shell">
          <header className="topbar">
          <button className="brand brand-bare" onClick={() => navigate({ name: 'home' })} type="button">
            {settings.site_logo ? <img className="brand-logo" src={settings.site_logo} alt="" /> : null}
            <span>
              <strong>{settings.site_title || publicInfo?.sitename || ''}</strong>
            </span>
          </button>
          <div className="topbar-actions">
            <div className="theme-toggle">
              <button className={classNames('theme-toggle-btn', settings.appearance === 'light' && 'active')} type="button" title={t('light')} onClick={() => { const next = { ...settings, appearance: 'light' as const }; setSettings(next); handleSaveSettings(next); }}><Sun size={15} /></button>
              <button className={classNames('theme-toggle-btn', settings.appearance === 'system' && 'active')} type="button" title={t('systemMode')} onClick={() => { const next = { ...settings, appearance: 'system' as const }; setSettings(next); handleSaveSettings(next); }}><Monitor size={15} /></button>
              <button className={classNames('theme-toggle-btn', settings.appearance === 'dark' && 'active')} type="button" title={t('dark')} onClick={() => { const next = { ...settings, appearance: 'dark' as const }; setSettings(next); handleSaveSettings(next); }}><Moon size={15} /></button>
            </div>
            {me.logged_in && (
              <button className="circle-button" type="button" title={t('settings')} onClick={() => setSettingsOpen(true)}>
                <Sliders size={18} />
              </button>
            )}
            <a className="circle-button" href="/admin" target="_self" title={t('admin')}><SettingsIcon size={18} /></a>
          </div>
        </header>

        {loadingError && <div className="notice danger">{loadingError}</div>}

        {route.name === 'home' ? (
          <Dashboard
            nodes={nodes}
            runtime={runtime}
            liveReady={liveReady}
            settings={settings}
            assets={assets}
            canShowAssets={canShowAssets}
            rateTable={rateTable}
            onOpenNode={(uuid) => navigate({ name: 'node', uuid })}
            onOpenAssetModal={() => setAssetModalOpen(true)}
            resolvedTheme={resolvedTheme}
            t={t}
          />
        ) : (
          <NodeDetail
            uuid={route.uuid}
            node={nodes.find((item) => item.uuid === route.uuid)}
            nodes={nodes}
            runtime={runtime}
            runtimeCurrent={runtime[route.uuid]}
            settings={settings}
            assets={assets}
            canShowAssets={canShowAssets}
            resolvedTheme={resolvedTheme}
            t={t}
            onBack={() => navigate({ name: 'home' })}
            onNavigate={(uuid) => navigate({ name: 'node', uuid })}
          />
        )}

        {settings.footer_enabled && <footer className="footer">{settings.footer_text || t('powered')}</footer>}
        </div>
      ) : (
        <div className="loading-screen"><div className="loading-cat" /></div>
      )}

      {settingsOpen && me.logged_in && (
        <SettingsModal
          settings={settings}
          t={t}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
          message={saveMessage}
        />
      )}
      {assetModalOpen && canShowAssets && (
        <AssetModal
          nodes={nodes}
          assets={assets}
          settings={settings}
          rateTable={rateTable}
          t={t}
          onClose={() => setAssetModalOpen(false)}
        />
      )}
    </>
  );
}

function Background({ settings, isMobile }: { settings: ThemeSettings; isMobile: boolean }) {
  const url = isMobile ? settings.mobile_background_url : settings.desktop_background_url;
  if (!url.trim()) return <div className="ambient-background" />;
  return (
    <div className="media-background">
      <video src={url} autoPlay muted loop playsInline preload="auto" style={{ opacity: 0, transition: 'opacity 0.3s' }} onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }} onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }} />
      <div className="background-image" style={{ backgroundImage: `url("${url}")` }} />
      <div className="background-filter" />
    </div>
  );
}

function Dashboard({
  nodes,
  runtime,
  liveReady,
  settings,
  assets,
  canShowAssets,
  rateTable,
  onOpenNode,
  onOpenAssetModal,
  resolvedTheme,
  t
}: {
  nodes: NodeInfo[];
  runtime: Record<string, LiveRuntime>;
  liveReady: boolean;
  settings: ThemeSettings;
  assets: AssetStats;
  canShowAssets: boolean;
  rateTable: RateTable | null;
  onOpenNode: (uuid: string) => void;
  onOpenAssetModal: () => void;
  resolvedTheme: 'light' | 'dark';
  t: Translator;
}) {
  const [pingModalUuid, setPingModalUuid] = useState<string | null>(null);
  const onlineCount = useMemo(() => nodes.filter((node) => runtime[node.uuid]?.online).length, [nodes, runtime]);
  const totalUp = useMemo(() => nodes.reduce((sum, node) => sum + safeNumber(runtime[node.uuid]?.totalUp), 0), [nodes, runtime]);
  const totalDown = useMemo(() => nodes.reduce((sum, node) => sum + safeNumber(runtime[node.uuid]?.totalDown), 0), [nodes, runtime]);
  const speedUp = useMemo(() => nodes.reduce((sum, node) => sum + safeNumber(runtime[node.uuid]?.netUp), 0), [nodes, runtime]);
  const speedDown = useMemo(() => nodes.reduce((sum, node) => sum + safeNumber(runtime[node.uuid]?.netDown), 0), [nodes, runtime]);
  const sorted = useMemo(() => sortNodes(nodes, runtime, settings, assets, liveReady), [nodes, runtime, settings, assets, liveReady]);

  return (
    <main className="page-stack">
      {settings.show_overview && (
        <section className="overview-grid" aria-label={t('dashboard')}>
          {settings.overview_online && (
            <OverviewTile
              icon={<Activity size={18} />}
              label={t('online')}
              value={`${onlineCount} / ${nodes.length}`}
              meter={nodes.length ? (onlineCount / nodes.length) * 100 : 0}
            />
          )}
          {settings.overview_asset && canShowAssets && (
            <OverviewTile
              icon={<Gauge size={18} />}
              label={t('assets')}
              value={formatMoney(assets.total, settings.target_currency)}
              rows={[`${t('remainingValue')}: ${formatMoney(assets.remaining, settings.target_currency)}`]}
              rating={getOverviewRating('asset', assets.total, settings, rateTable)}
              onClick={onOpenAssetModal}
            />
          )}
          {settings.overview_traffic && (
            <OverviewTile
              icon={<Download size={18} />}
              label={t('traffic')}
              value={formatBytes(totalUp + totalDown)}
              rows={[<><ArrowUp size={13} /> {formatBytes(totalUp)}</>, <><ArrowDown size={13} /> {formatBytes(totalDown)}</>]}
              rating={getOverviewRating('traffic', totalUp + totalDown, settings, rateTable)}
            />
          )}
          {settings.overview_realtime && (
            <OverviewTile
              icon={<Wifi size={18} />}
              label={t('realtimeSpeed')}
              value={formatSpeed(speedUp + speedDown)}
              rows={[<><ArrowUp size={13} /> {formatSpeed(speedUp)}</>, <><ArrowDown size={13} /> {formatSpeed(speedDown)}</>]}
              rating={getOverviewRating('speed', speedUp + speedDown, settings, rateTable)}
            />
          )}
        </section>
      )}

      <section className="section-heading">
        <div>
          <h1>{t('nodes')}</h1>
        </div>
        <span className="view-indicator"><LayoutGrid size={16} /></span>
      </section>

      <section className="node-collection">
        {sorted.map((node) => (
          <NodeCard
            key={node.uuid}
            node={node}
            runtime={runtime[node.uuid]}
            settings={settings}
            asset={assets.byNode[node.uuid]}
            canShowAssets={canShowAssets}
            t={t}
            onClick={() => onOpenNode(node.uuid)}
            onPing={() => setPingModalUuid(node.uuid)}
          />
        ))}
      </section>

      {pingModalUuid && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPingModalUuid(null); }}>
          <div className="ping-modal">
            <PingChart uuid={pingModalUuid} theme={resolvedTheme} t={t} serverName={nodes.find((n) => n.uuid === pingModalUuid)?.name || ''} onClose={() => setPingModalUuid(null)} />
          </div>
        </div>
      )}
    </main>
  );
}

function sortNodes(nodes: NodeInfo[], runtime: Record<string, LiveRuntime>, settings: ThemeSettings, assets: AssetStats, liveReady: boolean): NodeInfo[] {
  const getOnlineRank = (node: NodeInfo) => (liveReady && !runtime[node.uuid]?.online ? 1 : 0);
  return [...nodes].sort((a, b) => {
    const onlineDiff = getOnlineRank(a) - getOnlineRank(b);
    if (onlineDiff !== 0) return onlineDiff;
    const mode: SortMode = settings.sort_mode;
    if (mode === 'name') return a.name.localeCompare(b.name);
    if (mode === 'realtime') return safeNumber(runtime[b.uuid]?.netUp) + safeNumber(runtime[b.uuid]?.netDown) - safeNumber(runtime[a.uuid]?.netUp) - safeNumber(runtime[a.uuid]?.netDown);
    if (mode === 'traffic') return safeNumber(runtime[b.uuid]?.totalUp) + safeNumber(runtime[b.uuid]?.totalDown) - safeNumber(runtime[a.uuid]?.totalUp) - safeNumber(runtime[a.uuid]?.totalDown);
    if (mode === 'price') return safeNumber(assets.byNode[b.uuid]?.total) - safeNumber(assets.byNode[a.uuid]?.total);
    return safeNumber(b.weight) - safeNumber(a.weight) || a.name.localeCompare(b.name);
  });
}

function OverviewTile({ icon, label, value, rows, rating, meter, onClick }: { icon: ReactNode; label: string; value: string; rows?: ReactNode[]; rating?: string; meter?: number; onClick?: () => void }) {
  const Wrapper = onClick ? 'button' : 'article';
  return (
    <Wrapper className={classNames('overview-tile', onClick && 'clickable')} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="tile-head">
        <small>{label}</small>
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      {typeof meter === 'number' && <div className="tile-meter"><span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} /></div>}
      {!!rows?.length && <div className="tile-rows">
        {rows.map((row, index) => (
          <span key={index}>{row}</span>
        ))}
      </div>}
      {rating && <em>{rating}</em>}
    </Wrapper>
  );
}

function NodeCard({
  node,
  runtime,
  settings,
  asset,
  canShowAssets,
  t,
  onClick,
  onPing
}: {
  node: NodeInfo;
  runtime?: LiveRuntime;
  settings: ThemeSettings;
  asset?: AssetStats['byNode'][string];
  canShowAssets: boolean;
  t: Translator;
  onClick: () => void;
  onPing: () => void;
}) {
  const ramTotal = runtime?.ramTotal || node.mem_total || 0;
  const diskTotal = runtime?.diskTotal || node.disk_total || 0;
  const online = runtime?.online;
  const totalTraffic = safeNumber(runtime?.totalUp) + safeNumber(runtime?.totalDown);
  const trafficLimit = node.traffic_limit || 0;
  const trafficPercent = trafficLimit > 0 ? percent(totalTraffic, trafficLimit) : 0;
  const tags = parseTags(node.tags);
  const expiryDate = node.expired_at ? new Date(node.expired_at) : null;
  const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)) : null;
  const isLongTerm = !node.expired_at || node.billing_cycle === 0 || (daysLeft !== null && daysLeft > 36500);

  return (
    <button className={classNames('node-card', online === false && 'is-offline')} type="button" onClick={onClick}>
      {/* Header: flag + name | OS icon */}
      <div className="nc-header">
        <span className="nc-name">
          <span className={classNames('dot', online ? 'online-dot' : 'offline-dot')} />
          <FlagBadge region={node.region} />
          <strong>{node.name}</strong>
        </span>
        <span className="nc-os">
          <button className="nc-ping-btn" type="button" onClick={(e) => { e.stopPropagation(); onPing(); }} title={t('pingChart')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></button>
          <OsIcon os={node.os} />
        </span>
      </div>

      {/* Tags */}
      <div className="nc-tags">
        {tags.slice(0, 6).map((tag) => (
          <small key={tag.name} style={tag.color ? { background: `${tag.color}18`, color: tag.color } : undefined}>{tag.name}</small>
        ))}
      </div>

      {/* 2×2 Metrics with segmented bars */}
      <div className="nc-metrics">
        <MetricItem icon={<Cpu size={13} />} name="CPU" value={formatPercent(runtime?.cpu)} bar={safeNumber(runtime?.cpu)} color="#6366f1" />
        <MetricItem icon={<Activity size={13} />} name={t('memory')} value={formatPercent(percent(runtime?.ramUsed, ramTotal))} bar={percent(runtime?.ramUsed, ramTotal)} color="#14b8a6" />
        <MetricItem icon={<HardDrive size={13} />} name={t('disk')} value={formatPercent(percent(runtime?.diskUsed, diskTotal))} bar={percent(runtime?.diskUsed, diskTotal)} color="#f59e0b" />
        <MetricItem icon={<Gauge size={13} />} name={t('load')} value={formatLoad(runtime?.load1)} bar={Math.min(100, safeNumber(runtime?.load1) * 20)} color="#ef4444" />
      </div>

      {/* Data row: up(col) | down(col) | expiry+price */}
      <div className="nc-data-row">
        <div className="nc-data-col">
          <span className="nc-dv"><ArrowUp size={11} />{formatBytes(runtime?.totalUp)}</span>
          <span className="nc-dv-sub"><ArrowUp size={9} />{formatSpeed(runtime?.netUp)}</span>
        </div>
        <div className="nc-data-col">
          <span className="nc-dv"><ArrowDown size={11} />{formatBytes(runtime?.totalDown)}</span>
          <span className="nc-dv-sub"><ArrowDown size={9} />{formatSpeed(runtime?.netDown)}</span>
        </div>
        <div className="nc-data-col nc-data-right">
          {canShowAssets && asset?.valid && (
            <span className="nc-expiry-text">{formatMoney(asset.sourcePrice, asset.sourceCurrency)}{formatBillingCycle(node.billing_cycle, t)}</span>
          )}
          <span className="nc-expiry-text">{isLongTerm ? t('longTerm') : daysLeft !== null ? `${t('remaining')}${daysLeft}${t('daysLeftSuffix')}` : '-'}</span>
        </div>
      </div>

      {/* Traffic */}
      <div className="nc-traffic">
        <span className="nc-traffic-label"><Download size={13} /> {t('traffic')}</span>
        <span className="nc-traffic-right">
          <span>{runtime?.uptime ? formatUptime(runtime.uptime) : '-'}</span>
          <span>{formatBytes(totalTraffic)}{trafficLimit > 0 ? ` / ${formatBytes(trafficLimit)}` : ''}</span>
        </span>
      </div>
      {trafficLimit > 0 && (
        <div className="nc-traffic-bar">
          <span style={{ width: `${Math.min(100, trafficPercent)}%` }} />
        </div>
      )}

    </button>
  );
}

function MetricItem({ icon, name, value, bar, color }: { icon: ReactNode; name: string; value: string; bar: number; color?: string }) {
  return (
    <div className="metric-item">
      <div className="metric-head">
        <span className="metric-label">{icon}{name}</span>
        <span className="metric-val">{value}</span>
      </div>
      <SegmentedBar value={Math.min(100, Math.max(0, bar))} color={color} />
    </div>
  );
}

function SegmentedBar({ value, color }: { value: number; color?: string }) {
  const segments = 16;
  const filled = Math.round((value / 100) * segments);
  const barColor = color || 'var(--accent)';
  return (
    <div className="seg-bar">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={i < filled ? 'filled' : ''} style={i < filled ? { background: barColor } : undefined} />
      ))}
    </div>
  );
}

function parseTags(tags?: string): Array<{ name: string; color?: string }> {
  return (tags || '')
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const bracket = tag.match(/^(.+)<(.+)>$/);
      if (bracket) {
        const name = bracket[1].trim();
        const color = normalizeTagColor(bracket[2].trim());
        return { name, color };
      }
      const parts = tag.split(/[:=]/);
      if (parts.length >= 2 && parts[1].trim()) {
        const color = normalizeTagColor(parts.slice(1).join(':').trim());
        return { name: parts[0].trim(), color };
      }
      return { name: tag };
    });
}

function normalizeTagColor(color: string): string | undefined {
  const value = color.trim();
  if (!value) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  if (/^[0-9a-f]{3,8}$/i.test(value)) return `#${value}`;
  const named: Record<string, string> = {
    blue: '#3b82f6', green: '#22c55e', red: '#ef4444', orange: '#f97316',
    yellow: '#eab308', purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6',
    gray: '#6b7280', grey: '#6b7280', cyan: '#06b6d4', lime: '#84cc16',
    indigo: '#6366f1', rose: '#f43f5e', amber: '#f59e0b', emerald: '#10b981',
    sky: '#0ea5e9', violet: '#8b5cf6'
  };
  return named[value.toLowerCase()];
}


function FlagBadge({ region, className }: { region?: string; className?: string }) {
  if (!region) return null;
  const code = getCountryCode(region);
  if (!code) return <span className="flag-fallback">{region}</span>;
  const src = `/assets/flags/${code}.svg`;
  return (
    <span className="flag-wrap">
      <img src={src} alt={region} className={className || 'flag-img'} loading="lazy" draggable={false} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </span>
  );
}

function OsIcon({ os }: { os?: string }) {
  const [failed, setFailed] = useState(false);
  if (!os || failed) return <Terminal size={14} className="os-icon" />;
  const v = os.toLowerCase();
  for (const [key, patterns] of Object.entries(OS_KEYWORDS)) {
    if (patterns.some((p) => new RegExp(`\\b${p}\\b`).test(v))) {
      return <img className="os-icon" src={OS_IMAGES[key]} alt={os} title={os} draggable="false" loading="lazy" onError={() => setFailed(true)} />;
    }
  }
  return <Terminal size={14} className="os-icon" />;
}

function formatBillingCycle(cycle: number | undefined, t: Translator): string {
  if (!cycle || cycle <= 0) return `/${t('permanent')}`;
  if (cycle >= 365) return '/y';
  if (cycle >= 30) return '/mo';
  if (cycle >= 7) return '/wk';
  return '/d';
}

function NodeDetail({
  uuid,
  node,
  nodes,
  runtime,
  runtimeCurrent,
  settings,
  assets,
  canShowAssets,
  resolvedTheme,
  t,
  onBack,
  onNavigate
}: {
  uuid: string;
  node?: NodeInfo;
  nodes: NodeInfo[];
  runtime: Record<string, LiveRuntime>;
  runtimeCurrent?: LiveRuntime;
  settings: ThemeSettings;
  assets: AssetStats;
  canShowAssets: boolean;
  resolvedTheme: 'light' | 'dark';
  t: Translator;
  onBack: () => void;
  onNavigate: (uuid: string) => void;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [chartTab, setChartTab] = useState<'load' | 'ping'>('load');
  const trafficLimit = safeNumber(node?.traffic_limit);

  if (!node) {
    if (nodes.length === 0) return null;
    return (
      <main className="page-stack">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16} />{t('back')}</button>
        <div className="notice">{t('noData')}</div>
      </main>
    );
  }

  return (
    <main className="page-stack detail-page">
      <div className="detail-topbar">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16} />{t('back')}</button>
        <div className="node-switcher">
          <button className="text-button node-switcher-trigger" type="button" onClick={() => setSwitcherOpen((v) => !v)}>
            <span className={classNames('dot', runtimeCurrent?.online ? 'online-dot' : 'offline-dot')} />
            <strong>{node.name}</strong>
          </button>
          {switcherOpen && (
            <div className="node-switcher-panel">
              {nodes.map((n) => {
                const nodeRt = runtime[n.uuid];
                return (
                  <button
                    key={n.uuid}
                    className={classNames('node-switcher-item', n.uuid === uuid && 'active')}
                    type="button"
                    onClick={() => { setSwitcherOpen(false); onNavigate(n.uuid); }}
                  >
                    <span className={classNames('dot', nodeRt?.online ? 'online-dot' : 'offline-dot')} />
                    <span className="node-switcher-name">{n.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <section className="detail-panels">
        <DetailInfoPanel title={t('system')} icon={<Server size={16} />}>
          <DetailLine label={t('status')} value={runtimeCurrent?.online ? t('online') : t('offline')} />
          <DetailLine label="CPU" value={`${node.cpu_name || '-'} ${node.cpu_cores ? `x${node.cpu_cores}` : ''}`} />
          <DetailLine label={t('arch')} value={node.arch || '-'} />
          <DetailLine label={t('virtualization')} value={node.virtualization || '-'} />
          <DetailLine label={t('gpu')} value={node.gpu_name || '-'} />
          <DetailLine label={t('system')} value={node.os || '-'} />
        </DetailInfoPanel>
        <DetailInfoPanel title={t('resource')} icon={<Activity size={16} />}>
          <DetailLine label={t('memory')} value={`${formatBytes(runtimeCurrent?.ramUsed)} / ${formatBytes(runtimeCurrent?.ramTotal || node.mem_total)}`} />
          <DetailLine label={t('swap')} value={`${formatBytes(runtimeCurrent?.swapUsed)} / ${formatBytes(runtimeCurrent?.swapTotal || node.swap_total)}`} />
          <DetailLine label={t('disk')} value={`${formatBytes(runtimeCurrent?.diskUsed)} / ${formatBytes(runtimeCurrent?.diskTotal || node.disk_total)}`} />
          <DetailLine label={t('load')} value={`${formatLoad(runtimeCurrent?.load1)} | ${formatLoad(runtimeCurrent?.load5)} | ${formatLoad(runtimeCurrent?.load15)}`} />
          <DetailLine label={t('uptime')} value={runtimeCurrent?.uptime ? formatUptime(runtimeCurrent.uptime) : '-'} />
        </DetailInfoPanel>
        <DetailInfoPanel title={t('network')} icon={<Wifi size={16} />}>
          <DetailLine label={t('realtimeSpeed')} value={`${formatSpeed(runtimeCurrent?.netUp)} / ${formatSpeed(runtimeCurrent?.netDown)}`} />
          <DetailLine label={t('lastUpdated')} value={runtimeCurrent?.updatedAt ? new Date(runtimeCurrent.updatedAt).toLocaleString() : '-'} />
          <div className="detail-line is-stack">
            <span>{t('totalTraffic')}</span>
            <div className="detail-traffic">
              <span className="detail-traffic-value">{`↑ ${formatBytes(runtimeCurrent?.totalUp)} · ↓ ${formatBytes(runtimeCurrent?.totalDown)}`}</span>
              {trafficLimit > 0 && (
                <>
                  <div className="detail-progress-track" aria-hidden>
                    <span
                      className="detail-progress-fill"
                      style={{ width: `${resolveTrafficUsage(node.traffic_limit_type, safeNumber(runtimeCurrent?.totalUp), safeNumber(runtimeCurrent?.totalDown), trafficLimit).fraction * 100}%` }}
                    />
                  </div>
                  <span className="detail-traffic-note">
                    {`${formatBytes(resolveTrafficUsage(node.traffic_limit_type, safeNumber(runtimeCurrent?.totalUp), safeNumber(runtimeCurrent?.totalDown), trafficLimit).used)} / ${formatBytes(trafficLimit)}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </DetailInfoPanel>
      </section>

      <div className="chart-tabs">
        <Segmented items={[{ key: 'load', label: t('loadChart') }, { key: 'ping', label: t('pingChart') }]} active={chartTab} onChange={(next) => setChartTab(next as 'load' | 'ping')} />
      </div>
      {chartTab === 'load' ? (
        <LoadChart uuid={uuid} theme={resolvedTheme} t={t} />
      ) : (
        <PingChart uuid={uuid} theme={resolvedTheme} t={t} />
      )}
    </main>
  );
}

function DetailInfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="detail-panel">
      <h2>{icon}{title}</h2>
      <div>{children}</div>
    </article>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function LoadChart({ uuid, theme, t }: { uuid: string; theme: 'light' | 'dark'; t: Translator }) {
  const [period, setPeriod] = useState<LoadPeriod>('realtime');
  const [records, setRecords] = useState<FlatStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval = 0;
    const load = async () => {
      setLoading(true);
      try {
        const periodInfo = loadPeriods.find((item) => item.key === period)!;
        const next = period === 'realtime' ? await getRecentRecords(uuid) : (await getLoadRecords(uuid, periodInfo.hours)).records ?? [];
        if (!cancelled) setRecords(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    if (period === 'realtime') interval = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [uuid, period]);

  const latest = useMemo(() => latestRecord(records), [records]);

  const cpuOption = useMemo(() => buildCpuChartOption(records), [records]);
  const memOption = useMemo(() => buildMemoryChartOption(records), [records]);
  const diskOption = useMemo(() => buildDiskChartOption(records), [records]);
  const netOption = useMemo(() => buildNetworkOption(records), [records]);
  const connOption = useMemo(() => buildConnectionsChartOption(records), [records]);
  const procOption = useMemo(() => buildSingleMetricOption(records, t('process'), '#A78BFA', (r) => safeNumber(r.process), '', true), [records, t]);

  return (
    <section className="chart-section">
      <ChartHeader title={t('loadChart')} loading={loading} />
      <Segmented items={loadPeriods.map((item) => ({ key: item.key, label: t(item.label) }))} active={period} onChange={(next) => setPeriod(next as LoadPeriod)} />
      {records.length ? (
        <div className="metric-chart-grid">
          <MetricChartCard title="CPU" value={`${safeNumber(latest?.cpu).toFixed(1)}%`} option={cpuOption} theme={theme} />
          <MetricChartCard title={t('memory')} value={`${formatBytes(latest?.ram)} / ${formatBytes(latest?.ram_total)}`} option={memOption} theme={theme} />
          <MetricChartCard title={t('disk')} value={`${formatBytes(latest?.disk)} / ${formatBytes(latest?.disk_total)}`} option={diskOption} theme={theme} />
          <MetricChartCard title={t('network')} value={`${formatSpeed(latest?.net_out)} / ${formatSpeed(latest?.net_in)}`} option={netOption} theme={theme} />
          <MetricChartCard title={t('connections')} value={`TCP:${latest?.connections ?? '-'} | UDP:${latest?.connections_udp ?? '-'}`} option={connOption} theme={theme} />
          <MetricChartCard title={t('process')} value={String(latest?.process ?? '-')} option={procOption} theme={theme} />
        </div>
      ) : <div className="empty-chart">{t('noData')}</div>}
    </section>
  );
}

function MetricChartCard({ title, value, option, theme }: { title: string; value: string; option: EChartsCoreOption; theme: 'light' | 'dark' }) {
  return (
    <article className="metric-chart-card">
      <div className="metric-chart-head">
        <strong>{title}</strong>
        <span>{value}</span>
      </div>
      <EChart option={option} theme={theme} className="mini-chart" />
    </article>
  );
}

function formatChartTime(time: string | undefined, showDate: boolean): string {
  if (!time) return '';
  const d = new Date(time);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  if (showDate) return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  return `${hh}:${mm}:${ss}`;
}

function makeXAxis(records: FlatStatusRecord[]) {
  const data = records.filter((r) => r.time);
  const showDate = data.length > 288;
  return { type: 'category' as const, data: data.map((r) => formatChartTime(r.time, showDate)), axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false };
}

function buildSingleMetricOption(records: FlatStatusRecord[], name: string, color: string, getValue: (record: FlatStatusRecord) => number, unit: string, showArea = true): EChartsCoreOption {
  const data = records.filter((record) => record.time);
  return {
    color: [color],
    tooltip: { trigger: 'axis', valueFormatter: (value: string | number) => (typeof value === 'number' ? `${value.toFixed(1)}${unit}` : String(value)) },
    grid: { left: 46, right: 16, top: 12, bottom: 28 },
    xAxis: makeXAxis(records),
    yAxis: { type: 'value', min: 0, max: unit === '%' ? 100 : undefined, axisLabel: { formatter: `{value}${unit}`, fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ name, type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, areaStyle: showArea ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${color}40` }, { offset: 1, color: `${color}05` }] } } : undefined, data: data.map((record) => getValue(record)) }]
  };
}

function buildNetworkOption(records: FlatStatusRecord[]): EChartsCoreOption {
  const data = records.filter((record) => record.time);
  const labels = data.map((r) => formatChartTime(r.time, data.length > 288));
  return {
    color: ['#60A5FA', '#A78BFA'],
    tooltip: { trigger: 'axis', valueFormatter: (value: string | number) => (typeof value === 'number' ? formatSpeed(value) : String(value)) },
    legend: { data: ['↓ download', '↑ upload'], bottom: 4, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 10 } },
    grid: { left: 46, right: 16, top: 12, bottom: 48 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => formatBytes(value), fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: '↓ download', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((record) => safeNumber(record.net_in)) },
      { name: '↑ upload', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((record) => safeNumber(record.net_out)) }
    ]
  };
}

function buildCpuChartOption(records: FlatStatusRecord[]): EChartsCoreOption {
  const data = records.filter((r) => r.time);
  const labels = data.map((r) => formatChartTime(r.time, data.length > 288));
  return {
    color: ['#FF6B6B', '#FFB347'],
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = params as Array<{ seriesName: string; value: number; color: string }>;
      if (!p.length) return '';
      const idx = (p[0] as unknown as { dataIndex: number }).dataIndex;
      const time = labels[idx] || '';
      let html = `<div style="font-weight:600;margin-bottom:4px;color:#888;font-size:12px">${time}</div>`;
      for (const item of p) {
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>`;
        const val = item.seriesName === 'CPU' ? `${item.value?.toFixed(1)}%` : item.value?.toFixed(2);
        html += `<div style="display:flex;align-items:center;gap:4px">${dot}<span>${item.seriesName}</span><span style="margin-left:auto;font-weight:600">${val}</span></div>`;
      }
      return html;
    }},
    grid: { left: 46, right: 46, top: 12, bottom: 28 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: [
      { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
      { type: 'value', min: 0, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } }
    ],
    series: [
      { name: 'CPU', type: 'line', smooth: 0.6, showSymbol: false, yAxisIndex: 0, lineStyle: { width: 2.5, cap: 'round' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,107,107,0.25)' }, { offset: 1, color: 'rgba(255,107,107,0.02)' }] } }, data: data.map((r) => r.cpu) },
      { name: 'Load', type: 'line', smooth: 0.6, showSymbol: false, yAxisIndex: 1, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((r) => r.load) }
    ]
  };
}

function buildDiskChartOption(records: FlatStatusRecord[]): EChartsCoreOption {
  const data = records.filter((r) => r.time);
  const labels = data.map((r) => formatChartTime(r.time, data.length > 288));
  return {
    color: ['#4ECDC4'],
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = params as Array<{ dataIndex: number; value: number; color: string }>;
      if (!p.length) return '';
      const idx = p[0].dataIndex;
      const r = data[idx];
      if (!r) return '';
      const used = r.disk ?? 0;
      const total = r.disk_total ?? 0;
      const pct = total > 0 ? (used / total * 100).toFixed(1) : '0';
      return `<div style="font-weight:600;margin-bottom:4px;color:#888;font-size:12px">${labels[idx] || ''}</div><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ECDC4"></span><span>${pct}%</span><span style="margin-left:auto;font-weight:600">${formatBytes(used)} / ${formatBytes(total)}</span></div>`;
    }},
    grid: { left: 46, right: 16, top: 12, bottom: 28 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ name: 'Disk', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(78,205,196,0.25)' }, { offset: 1, color: 'rgba(78,205,196,0.02)' }] } }, data: data.map((r) => { const t = r.disk_total ?? 0; return t > 0 ? (r.disk ?? 0) / t * 100 : 0; }) }]
  };
}

function buildMemoryChartOption(records: FlatStatusRecord[]): EChartsCoreOption {
  const data = records.filter((r) => r.time);
  const labels = data.map((r) => formatChartTime(r.time, data.length > 288));
  return {
    color: ['#FF6B6B', '#FFB347'],
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = params as Array<{ seriesName: string; value: number; color: string }>;
      if (!p.length) return '';
      const idx = (p[0] as unknown as { dataIndex: number }).dataIndex;
      const time = labels[idx] || '';
      let html = `<div style="font-weight:600;margin-bottom:4px;color:#888;font-size:12px">${time}</div>`;
      for (const item of p) {
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>`;
        html += `<div style="display:flex;align-items:center;gap:4px">${dot}<span>${item.seriesName}</span><span style="margin-left:auto;font-weight:600">${formatBytes(item.value)}</span></div>`;
      }
      return html;
    }},
    grid: { left: 46, right: 16, top: 12, bottom: 28 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatBytes(v), fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: 'RAM', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,107,107,0.25)' }, { offset: 1, color: 'rgba(255,107,107,0.02)' }] } }, data: data.map((r) => r.ram) },
      { name: 'Swap', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((r) => r.swap) }
    ]
  };
}

function buildConnectionsChartOption(records: FlatStatusRecord[]): EChartsCoreOption {
  const data = records.filter((r) => r.time);
  const labels = data.map((r) => formatChartTime(r.time, data.length > 288));
  return {
    color: ['#FF6B6B', '#4ECDC4'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['TCP', 'UDP'], bottom: 4, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 10 } },
    grid: { left: 46, right: 16, top: 12, bottom: 48 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: 'TCP', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((r) => safeNumber(r.connections)) },
      { name: 'UDP', type: 'line', smooth: 0.6, showSymbol: false, lineStyle: { width: 2.5, cap: 'round' }, data: data.map((r) => safeNumber(r.connections_udp)) }
    ]
  };
}

function PingChart({ uuid, theme, t, serverName, onClose }: { uuid: string; theme: 'light' | 'dark'; t: Translator; serverName?: string; onClose?: () => void }) {
  const [period, setPeriod] = useState<PingPeriod>('1h');
  const [data, setData] = useState<PingRecordResponse>({ records: [], tasks: [] });
  const [visible, setVisible] = useState<Record<number, boolean>>({});
  const [smooth, setSmooth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);

  useEffect(() => { setVisible({}); }, [uuid]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const periodInfo = pingPeriods.find((item) => item.key === period)!;
        const next = await getPingRecords(uuid, periodInfo.hours);
        if (!cancelled) {
          setData(next);
          setVisible((previous) => {
            const copy = { ...previous };
            for (const task of normalizeTasks(next)) copy[task.id] ??= true;
            return copy;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [uuid, period]);

  const tasks = useMemo(() => normalizeTasks(data), [data]);
  const records = data.records ?? [];
  const allVisible = tasks.length > 0 && tasks.every((task) => visible[task.id] !== false);

  const taskStats = useMemo(() => {
    const stats: Record<number, { min: number | null; max: number | null; avg: number | null; latest: number | null; p50: number | null; p99: number | null; loss: number; volatility: number; count: number }> = {};
    for (const task of tasks) {
      const taskRecords = records.filter((r) => r.task_id === task.id);
      const validRecords = taskRecords.filter((r) => r.value >= 0);
      const latest = validRecords.length ? validRecords[validRecords.length - 1].value : null;
      const avg = validRecords.length ? validRecords.reduce((s, r) => s + r.value, 0) / validRecords.length : null;
      const min = validRecords.length ? Math.min(...validRecords.map((r) => r.value)) : null;
      const max = validRecords.length ? Math.max(...validRecords.map((r) => r.value)) : null;
      const sorted = validRecords.map((r) => r.value).sort((a, b) => a - b);
      const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : null;
      const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : null;
      const loss = taskRecords.length > 0 ? ((taskRecords.length - validRecords.length) / taskRecords.length * 100) : 0;
      const volatility = p50 != null && p99 != null ? (p99 - p50) / Math.min(50, Math.max(10, p50)) : 0;
      stats[task.id] = { min, max, avg, latest, p50, p99, loss, volatility, count: taskRecords.length };
    }
    return stats;
  }, [tasks, records]);

  function handleToggleAll() {
    if (allVisible) {
      setVisible(Object.fromEntries(tasks.map((task) => [task.id, false])));
    } else {
      setVisible(Object.fromEntries(tasks.map((task) => [task.id, true])));
    }
  }

  function handleTaskToggle(taskId: number) {
    if (allVisible) {
      setVisible(Object.fromEntries(tasks.map((task) => [task.id, task.id === taskId])));
    } else {
      setVisible((previous) => ({ ...previous, [taskId]: previous[taskId] === false }));
    }
  }

  const activeTasks = tasks.filter((task) => visible[task.id] !== false);
  const pingColors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#60A5FA', '#FFB347', '#F472B6', '#34D399', '#FB923C'];

  const chartOption = useMemo(() => buildPingOption(records, activeTasks, tasks, smooth, pingColors), [records, activeTasks, tasks, smooth]);

  return (
    <section className="chart-section">
      <ChartHeader title={serverName ? `${serverName} - ${t('pingChart')}` : t('pingChart')} loading={loading} onClose={onClose} />
      <div className="ping-seg-center">
        <Segmented items={pingPeriods.map((item) => ({ key: item.key, label: t(item.label) }))} active={period} onChange={(next) => setPeriod(next as PingPeriod)} />
      </div>
      {tasks.length > 0 && (
        <div className="ping-task-grid">
          {tasks.map((task, idx) => {
            const isActive = visible[task.id] !== false;
            const s = taskStats[task.id] || { min: null, max: null, avg: null, latest: null, p50: null, p99: null, loss: 0, volatility: 0, count: 0 };
            const { loss, volatility, latest, count } = s;
            const lossColor = loss === 0 ? '#22c55e' : loss < 5 ? '#FFB347' : loss < 20 ? '#f97316' : '#FF6B6B';
            const latColor = latest != null ? (latest < 50 ? '#22c55e' : latest < 100 ? '#FFB347' : latest < 200 ? '#f97316' : '#FF6B6B') : '#888';
            const lineColor = pingColors[idx % pingColors.length];
            return (
              <div key={task.id} role="button" tabIndex={0} className={classNames('ping-task-card', !isActive && 'muted')} onClick={() => handleTaskToggle(task.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTaskToggle(task.id); }} style={{ '--task-color': lineColor } as React.CSSProperties}>
                <span className="ping-task-bar" style={{ background: lineColor }} />
                <div className="ping-task-body">
                  <div className="ping-task-header">
                    <span className="ping-task-name">{task.name}</span>
                    <span className="ping-task-info-wrap" onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                      <span className="ping-task-info" />
                      {hoveredTask === task.id && (
                        <div className="ping-task-tip">
                          <div className="ping-task-tip-grid">
                            <span className="ping-task-tip-label">{t('pingMin')}</span><span className="ping-task-tip-val">{s.min != null ? `${s.min.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingMax')}</span><span className="ping-task-tip-val">{s.max != null ? `${s.max.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingAvg')}</span><span className="ping-task-tip-val">{s.avg != null ? `${s.avg.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingLatest')}</span><span className="ping-task-tip-val">{latest != null ? `${latest.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingP50')}</span><span className="ping-task-tip-val">{s.p50 != null ? `${s.p50.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingP99')}</span><span className="ping-task-tip-val">{s.p99 != null ? `${s.p99.toFixed(0)}${t('pingUnit')}` : '-'}</span>
                            <span className="ping-task-tip-label">{t('pingVolatility')}</span><span className="ping-task-tip-val">{volatility.toFixed(2)}</span>
                            <span className="ping-task-tip-label">{t('pingLoss')}</span><span className="ping-task-tip-val">{loss.toFixed(1)}%</span>
                            <span className="ping-task-tip-label">{t('pingSamples')}</span><span className="ping-task-tip-val">{count}</span>
                          </div>
                        </div>
                      )}
                    </span>
                  </div>
                  <div className="ping-task-metrics">
                    <span className="ping-task-val" style={{ color: latColor }}>{latest != null ? `${latest.toFixed(0)} ms` : '-'}</span>
                    <span className="ping-task-sep">·</span>
                    <span className="ping-task-loss" style={{ color: lossColor }}>{loss.toFixed(1)}% {t('pingLoss')}</span>
                    <span className="ping-task-sep">·</span>
                    <span className="ping-task-vol">{volatility.toFixed(1)} {t('pingVolatility')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="chart-tools">
        <button type="button" onClick={handleToggleAll}>
          {allVisible ? <><EyeOff size={15} />{t('hideAll')}</> : <><Eye size={15} />{t('showAll')}</>}
        </button>
        <label className="switch-label">
          <span>{t('smoothPeaks')}</span>
          <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
        </label>
      </div>
      {records.length && tasks.length && activeTasks.length > 0 ? (
        <EChart option={chartOption} theme={theme} className="chart" />
      ) : (
        <div className="empty-chart">{t('noData')}</div>
      )}
    </section>
  );
}

function normalizeTasks(data: PingRecordResponse): Array<{ id: number; name: string }> {
  const fromRecords = new Set((data.records ?? []).map((record) => record.task_id));
  const tasks = [...(data.tasks ?? []).map((task) => ({ id: task.id, name: task.name || `Ping ${task.id}` }))];
  for (const id of fromRecords) {
    if (!tasks.some((task) => task.id === id)) tasks.push({ id, name: `Ping ${id}` });
  }
  return tasks.sort((a, b) => a.id - b.id);
}

function buildPingOption(records: PingRecord[], activeTasks: Array<{ id: number; name: string }>, allTasks: Array<{ id: number; name: string }>, smooth: boolean, colors: string[]): EChartsCoreOption {
  const allTimes = [...new Set(records.filter((r) => r.time).map((r) => r.time))].sort();
  const showDate = allTimes.length > 288;
  const timeLabels = allTimes.map((t) => formatChartTime(t, showDate));
  return {
    color: colors,
    tooltip: { trigger: 'axis', valueFormatter: (value: string | number) => (typeof value === 'number' ? `${value.toFixed(0)} ms` : '-') },
    grid: { left: 46, right: 24, top: 20, bottom: 36 },
    xAxis: { type: 'category', data: timeLabels, axisLabel: { fontSize: 10, hideOverlap: true }, axisTick: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: '{value} ms', fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
    series: activeTasks.map((task) => {
      const taskIdx = allTasks.findIndex((t) => t.id === task.id);
      const color = colors[taskIdx % colors.length];
      const taskRecords = records.filter((r) => r.task_id === task.id && r.time);
      const valueMap = new Map(taskRecords.map((r) => [formatChartTime(r.time, showDate), r.value < 0 ? null : r.value]));
      const data = timeLabels.map((label) => valueMap.get(label) ?? null);
      return {
        name: task.name,
        type: 'line',
        smooth: smooth ? 0.4 : 0.6,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color, cap: 'round' },
        data: smooth ? smoothPingValues(data) : data
      };
    })
  };
}

function smoothPingValues(values: (number | null)[]): (number | null)[] {
  return values.map((value, index) => {
    if (value === null) return null;
    const neighbors = values.slice(Math.max(0, index - 2), Math.min(values.length, index + 3)).filter((v): v is number => v !== null);
    if (!neighbors.length) return value;
    const average = neighbors.reduce((sum, item) => sum + item, 0) / neighbors.length;
    const capped = value > average * 2.5 && value - average > 80 ? average * 1.35 : value;
    return (capped + average) / 2;
  });
}

function ChartHeader({ title, loading, onClose }: { title: string; loading: boolean; onClose?: () => void }) {
  return (
    <div className="chart-header">
      <h2>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {loading && <span className="loading-dot" />}
        {onClose && <button className="ping-modal-close" type="button" onClick={onClose}><X size={18} /></button>}
      </div>
    </div>
  );
}

function Segmented({ items, active, onChange }: { items: Array<{ key: string; label: string }>; active: string; onChange: (key: string) => void }) {
  return (
    <div className="segmented">
      {items.map((item) => (
        <button key={item.key} className={item.key === active ? 'active' : ''} type="button" onClick={() => onChange(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SettingsModal({ settings, t, onClose, onSave, message }: { settings: ThemeSettings; t: Translator; onClose: () => void; onSave: (settings: ThemeSettings) => void; message: string }) {
  const [draft, setDraft] = useState(settings);

  function update<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        <div className="settings-header">
          <div>
            <h2>{t('settings')}</h2>
            <p>{t('adminOnly')}</p>
          </div>
          <button className="icon-button" type="button" title={t('close')} onClick={onClose}><X size={18} /></button>
        </div>

        <div className="settings-content">
          <SettingsGroup title={t('appearance')}>
            <SelectField label={t('appearance')} value={draft.appearance} onChange={(value) => update('appearance', value as ThemeSettings['appearance'])} options={[
              ['system', t('systemMode')], ['light', t('light')], ['dark', t('dark')]
            ]} />
            <SwitchField label={t('glassEffect')} checked={draft.glass_enabled} onChange={(value) => update('glass_enabled', value)} />
            <RangeField label={t('cardOpacity')} value={draft.card_opacity} min={45} max={100} onChange={(value) => update('card_opacity', value)} />
          </SettingsGroup>

          <SettingsGroup title={t('background')}>
            <label className="field-row wide-field">
              <span>{t('desktopBackground')}</span>
              <input value={draft.desktop_background_url} onChange={(event) => update('desktop_background_url', event.target.value)} placeholder="URL" />
            </label>
            <label className="field-row wide-field">
              <span>{t('mobileBackground')}</span>
              <input value={draft.mobile_background_url} onChange={(event) => update('mobile_background_url', event.target.value)} placeholder="URL" />
            </label>
            <p className="field-help">{t('backgroundHelp')}</p>
          </SettingsGroup>

          <SettingsGroup title={t('siteBranding')}>
            <label className="field-row wide-field">
              <span>{t('siteLogo')}</span>
              <input value={draft.site_logo} onChange={(event) => update('site_logo', event.target.value)} placeholder="URL" />
            </label>
            <label className="field-row wide-field">
              <span>{t('siteTitle')}</span>
              <input value={draft.site_title} onChange={(event) => update('site_title', event.target.value)} placeholder="Komari" />
            </label>
            <p className="field-help">{t('siteBrandingHelp')}</p>
          </SettingsGroup>

          <SettingsGroup title={t('footer')}>
            <SwitchField label={t('footerEnabled')} checked={draft.footer_enabled} onChange={(value) => update('footer_enabled', value)} />
            <label className="field-row wide-field">
              <span>{t('footerText')}</span>
              <input value={draft.footer_text} onChange={(event) => update('footer_text', event.target.value)} placeholder="Powered by Komari · Theme by shan" />
            </label>
          </SettingsGroup>

          <SettingsGroup title={t('dashboardOptions')}>
            <label className="field-row">
              <span>{t('dataUpdateInterval')}</span>
              <input type="number" min={1} max={300} value={draft.data_update_interval} onChange={(event) => update('data_update_interval', Math.max(1, Number(event.target.value) || 1))} />
              <b>s</b>
            </label>
            <SwitchField label={t('showOverview')} checked={draft.show_overview} onChange={(value) => update('show_overview', value)} />
            <div className="checkbox-grid">
              <SwitchField label={t('online')} checked={draft.overview_online} onChange={(value) => update('overview_online', value)} />
              <SwitchField label={t('realtimeSpeed')} checked={draft.overview_realtime} onChange={(value) => update('overview_realtime', value)} />
              <SwitchField label={t('traffic')} checked={draft.overview_traffic} onChange={(value) => update('overview_traffic', value)} />
              <SwitchField label={t('assets')} checked={draft.overview_asset} onChange={(value) => update('overview_asset', value)} />
            </div>
            <SelectField label={t('sorting')} value={draft.sort_mode} onChange={(value) => update('sort_mode', value as ThemeSettings['sort_mode'])} options={[
              ['default', t('defaultSort')], ['name', t('sortByName')], ['realtime', t('sortByRealtime')], ['traffic', t('sortByTraffic')], ['price', t('sortByPrice')]
            ]} />
          </SettingsGroup>

          <SettingsGroup title={t('ratings')}>
            <SwitchField label={t('enableRatings')} checked={draft.ratings_enabled} onChange={(value) => update('ratings_enabled', value)} />
            <TextField label={t('ratingLabels')} value={draft.rating_labels} onChange={(value) => update('rating_labels', value)} />
          </SettingsGroup>

          <SettingsGroup title={t('assetsExchange')}>
            <SwitchField label={t('enableAssets')} checked={draft.asset_value_enabled} onChange={(value) => update('asset_value_enabled', value)} />
            <SwitchField label={t('visitorsSeeAssets')} checked={draft.visitor_asset_visible} onChange={(value) => update('visitor_asset_visible', value)} />
            <SelectField label={t('targetCurrency')} value={draft.target_currency} onChange={(value) => update('target_currency', value as CurrencyCode)} options={currencyOptions()} />
            <SelectField label={t('fallbackCurrency')} value={draft.fallback_source_currency} onChange={(value) => update('fallback_source_currency', value as CurrencyCode)} options={currencyOptions()} />
            <TextField label={t('exchangeApi')} value={draft.exchange_api} onChange={(value) => update('exchange_api', value)} />
          </SettingsGroup>
        </div>

        <div className="settings-footer">
          <span>{message}</span>
          <button className="text-button" type="button" onClick={onClose}><X size={16} />{t('cancel')}</button>
          <button className="primary-button" type="button" onClick={() => onSave(draft)}><Save size={16} />{t('save')}</button>
        </div>
      </div>
    </div>
  );
}

function AssetModal({ nodes, assets, settings, rateTable, t, onClose }: { nodes: NodeInfo[]; assets: AssetStats; settings: ThemeSettings; rateTable: RateTable | null; t: Translator; onClose: () => void }) {
  const annual = nodes.reduce((sum, node) => {
    const asset = assets.byNode[node.uuid];
    if (!asset?.valid) return sum;
    const cycle = safeNumber(node.billing_cycle);
    if (cycle > 0) sum += (asset.total / cycle) * 365;
    return sum;
  }, 0);
  const monthlyReal = annual / 12;
  const rows = nodes.map((node) => ({ node, asset: assets.byNode[node.uuid] })).filter((row) => row.asset?.valid).sort((a, b) => b.asset.total - a.asset.total);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="asset-panel">
        <div className="asset-header">
          <div>
            <h2>{t('assets')}</h2>
            <p>{t('nodeInfo')}</p>
          </div>
          <button className="icon-button" type="button" title={t('close')} onClick={onClose}><X size={18} /></button>
        </div>

        <div className="asset-summary">
          <div>
            <small>{t('remainingValue')}</small>
            <strong>{formatMoney(assets.remaining, settings.target_currency)}</strong>
          </div>
          <div>
            <small>{t('annualCost')}</small>
            <strong>{formatMoney(annual, settings.target_currency)}</strong>
          </div>
          <div>
            <small>{t('monthlyCost')}</small>
            <strong>{formatMoney(monthlyReal, settings.target_currency)}</strong>
          </div>
        </div>

        <div className="asset-table-wrap">
          <div className="asset-grid">
            <div className="asset-grid-head">
              <span>{t('nodes')}</span>
              <span>{t('price')}</span>
              <span>{t('remainingValue')}</span>
              <span>{t('expiresAt')}</span>
            </div>
            {rows.map(({ node, asset }) => {
              const expiryDate = node.expired_at ? new Date(node.expired_at) : null;
              const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)) : null;
              const isLongTerm = !node.expired_at || node.billing_cycle === 0 || (daysLeft !== null && daysLeft > 36500);
              return (
                <div className="asset-grid-row" key={node.uuid}>
                  <span className="asset-node"><FlagBadge region={node.region} />{node.name}</span>
                  <span>{formatMoney(asset.sourcePrice, asset.sourceCurrency)}{formatBillingCycle(node.billing_cycle, t)}</span>
                  <span>{formatMoney(asset.remaining, settings.target_currency)}</span>
                  <span>{isLongTerm ? t('longTerm') : daysLeft !== null ? `${daysLeft}${t('daysLeftSuffix')}` : '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="asset-footer">
          <span>{t('totalValue')}: {formatMoney(assets.total, settings.target_currency)}</span>
        </div>
      </div>
    </div>
  );
}

function currencyOptions(): Array<[CurrencyCode, string]> {
  return [['CNY', 'CNY'], ['HKD', 'HKD'], ['USD', 'USD'], ['EUR', 'EUR'], ['GBP', 'GBP']];
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h3>{title}</h3>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-row wide-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RangeField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <b>{value}%</b>
    </label>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="switch-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
