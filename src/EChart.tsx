import { useEffect, useRef, useState } from 'react';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

interface EChartProps {
  option: EChartsCoreOption;
  theme: 'light' | 'dark';
  className?: string;
}

let echartsPromise: Promise<typeof import('echarts/core')> | null = null;
function getEcharts() {
  if (!echartsPromise) echartsPromise = (async () => {
    const core = await import('echarts/core');
    const { LineChart } = await import('echarts/charts');
    const { GridComponent, TooltipComponent, LegendComponent } = await import('echarts/components');
    const { CanvasRenderer } = await import('echarts/renderers');
    core.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
    return core;
  })();
  return echartsPromise;
}

export function EChart({ option, theme, className }: EChartProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const themeRef = useRef(theme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const element = elementRef.current;
    if (!element) return;

    getEcharts().then((echarts) => {
      if (disposed || elementRef.current !== element) return;
      const currentTheme = themeRef.current === 'dark' ? 'dark' : undefined;
      chartRef.current = echarts.init(element, currentTheme, { renderer: 'canvas' });
      chartRef.current.setOption(option, true);
      setReady(true);

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => chartRef.current?.resize());
        observer.observe(element);
        resizeObserverRef.current = observer;
      }
    });
    return () => {
      disposed = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (themeRef.current === theme) {
      chartRef.current?.setOption(option, true);
      return;
    }

    let disposed = false;
    const element = elementRef.current;
    if (!element) return;

    getEcharts().then((echarts) => {
      if (disposed || elementRef.current !== element) return;
      chartRef.current?.dispose();
      chartRef.current = echarts.init(element, theme === 'dark' ? 'dark' : undefined, { renderer: 'canvas' });
      themeRef.current = theme;
      chartRef.current.setOption(option, true);
      chartRef.current.resize();
    });

    return () => { disposed = true; };
  }, [option, theme, ready]);

  return <div ref={elementRef} className={className ?? 'chart'} />;
}
