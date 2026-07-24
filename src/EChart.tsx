import { useEffect, useRef, useState } from 'react';
import type { EChartsOption, EChartsType } from 'echarts';

interface EChartProps {
  option: EChartsOption;
  theme: 'light' | 'dark';
  className?: string;
}

let echartsPromise: Promise<typeof import('echarts')> | null = null;
function getEcharts() {
  if (!echartsPromise) echartsPromise = import('echarts');
  return echartsPromise;
}

export function EChart({ option, theme, className }: EChartProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const themeRef = useRef(theme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    getEcharts().then((echarts) => {
      if (disposed || !elementRef.current) return;
      const currentTheme = themeRef.current === 'dark' ? 'dark' : undefined;
      chartRef.current = echarts.init(elementRef.current, currentTheme, { renderer: 'canvas' });
      chartRef.current.setOption(option, true);
      setReady(true);

      const observer = new ResizeObserver(() => chartRef.current?.resize());
      observer.observe(elementRef.current);
    });
    return () => { disposed = true; chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (themeRef.current === theme) {
      chartRef.current?.setOption(option, true);
      return;
    }
    themeRef.current = theme;
    if (!elementRef.current) return;
    getEcharts().then((echarts) => {
      chartRef.current?.dispose();
      chartRef.current = echarts.init(elementRef.current!, theme === 'dark' ? 'dark' : undefined, { renderer: 'canvas' });
      chartRef.current.setOption(option, true);
    });
  }, [option, theme, ready]);

  return <div ref={elementRef} className={className ?? 'chart'} />;
}
