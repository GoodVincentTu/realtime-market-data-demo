import { useEffect, useRef } from "react";
import { createChart, LineSeries } from "lightweight-charts";
import type { ISeriesApi, UTCTimestamp } from "lightweight-charts";

type TickMsg = { symbol: string; price: number; ts: string | number };

export default function LiveChart({
  data,
  symbol,
}: {
  data: TickMsg[];
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      // v5 supports autoSize so we don't need our own ResizeObserver
      // (docs: Chart options include autoSize)
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#0f172a" },
      grid: { vertLines: { color: "#e2e8f0" }, horzLines: { color: "#e2e8f0" } },
      timeScale: { rightOffset: 6, barSpacing: 6, fixLeftEdge: true },
    });

    // v5 series creation API (built-in definition)
    const series = chart.addSeries(LineSeries, {
      lineWidth: 2,
      color: "#0f766e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const toTs = (t: string | number): UTCTimestamp =>
      typeof t === "number"
        ? (Math.floor(t) as UTCTimestamp)
        : (Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp);

    series.setData(
      data.map((d) => ({
        time: toTs(d.ts),
        value: d.price,
      }))
    );
  }, [data, symbol]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[320px] rounded border border-slate-200 bg-white"
    />
  );
}