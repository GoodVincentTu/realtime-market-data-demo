import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

type CandlePoint = { time: UTCTimestamp; open: number; high: number; low: number; close: number };
type LinePoint   = { time: UTCTimestamp; value: number };
type VolumePoint = { time: UTCTimestamp; value: number; color?: string };

export default function LiveChart({
  symbol,
  candles,
  sma,
  volumes,
}: {
  symbol: string;
  candles: CandlePoint[];
  sma: LinePoint[];
  volumes: VolumePoint[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: '#ffffff' }, textColor: '#0f172a' },
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      timeScale: { rightOffset: 4, barSpacing: 6, fixLeftEdge: true },
      // panes: { enableResize: false },
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      priceScaleId: 'right',
      upColor: '#16a34a',
      downColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
    });
    candleRef.current = candle;

    const smaLine = chart.addSeries(LineSeries, { lineWidth: 2, color: '#2563eb' });
    smaRef.current = smaLine;

    const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'volume' }, 1);
    volRef.current = vol;

    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.05, bottom: 0.25 } });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      smaRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !smaRef.current || !volRef.current) return;

    const validTime = <T extends { time: UTCTimestamp }>(p: T) =>
      Number.isFinite(p.time as unknown as number);

    const asc = <T extends { time: UTCTimestamp }>(a: T, b: T) =>
      (a.time as unknown as number) - (b.time as unknown as number);

    const c = candles.filter(validTime).slice().sort(asc);
    const s = sma.filter(validTime).slice().sort(asc);
    const v = volumes.filter(validTime).slice().sort(asc);

    candleRef.current.setData(c);
    smaRef.current.setData(s);
    volRef.current.setData(v);
  }, [symbol, candles, sma, volumes]);

  return (
    <div ref={containerRef} className="w-full h-[420px] rounded border border-slate-200 bg-white" />
  );
}