import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SymbolInfo, CandleItem, SseTickMsg } from '../domain/types';
import type { UTCTimestamp } from 'lightweight-charts';
import { listSymbols, getTickHistoryV2 } from "../api/symbols";
import { REALTIME_URL } from "../api/client";
import { useSSE } from "../hooks/useSSE";
// preivous version
// import { listSymbols, getTickHistory } from "../api/symbols";
// import type { Tick } from "../domain/types";
// import LiveChart from "../components/LiveChart";
// import { appendMonotonic, mergeHistoryLive } from "../utils/ticks";
import LiveChart from "../components/LiveChartUpgrade";
import Loading from "../components/Loading";
import { toUtc, upsertAsc } from '../utils/series';


type CandlePoint = { time: UTCTimestamp; open: number; high: number; low: number; close: number };
type LinePoint = { time: UTCTimestamp; value: number };
type VolumePoint = { time: UTCTimestamp; value: number; color: string };

export default function Dashboard() {
  // const { data: symbols = [], isLoading } = useQuery({
  //   queryKey: ["symbols"],
  //   queryFn: listSymbols,
  // });

  // const [symbol, setSymbol] = useState<string>("");

  // useEffect(() => {
  //   if (!isLoading && symbols.length && !symbol) setSymbol(symbols[0].symbol);
  // }, [isLoading, symbols, symbol]);

  // const { data: history = [], isLoading: booting } = useQuery({
  //   enabled: !!symbol,
  //   queryKey: ["tickHistory", symbol],
  //   queryFn: () => getTickHistory(symbol, 200),
  // });

  // const [live, setLive] = useState<Tick[]>([]);

  // // carry token via query param if your realtime gateway needs auth for SSE
  // const sseUrl = useMemo(() => {
  //   if (!symbol) return undefined;
  //   const token = localStorage.getItem("token");
  //   const qp = new URLSearchParams({ symbol });
  //   if (token) qp.set("token", token);
  //   return `${REALTIME_URL}?${qp.toString()}`;
  // }, [symbol]);

  // // if symbol changes, clear live buffer (history will reload anyway)
  // useEffect(() => setLive([]), [symbol]);

  // useSSE<Tick>(sseUrl, (msg) => {
  //   if (!msg || msg.symbol !== symbol) return;
  //   setLive((prev) => appendMonotonic(prev, msg, 300));
  // });

  // // merge: drop any live ticks older/equal to last history second and keep ASC
  // const merged = useMemo(() => mergeHistoryLive(history, live), [history, live]);
  // if (isLoading || booting) return <Loading label="Loading dashboard..." />;


  /** new version */
  const { data: symbols, isLoading: loadingSymbols } = useQuery<SymbolInfo[], Error>({
    queryKey: ['symbols'],
    queryFn: listSymbols,
  });
  const symList: SymbolInfo[] = symbols ?? [];

  const [symbol, setSymbol] = useState<string>('');
  useEffect(() => {
    if (!loadingSymbols && symList.length && !symbol) setSymbol(symList[0].symbol);
  }, [loadingSymbols, symList, symbol]);
  // HTTP bootstrap: 1m candles with volume & sma10
  const { data: hist = [], isLoading: booting } = useQuery<CandleItem[]>({
    enabled: !!symbol,
    queryKey: ['tickHistory', symbol],
    queryFn: () => getTickHistoryV2(symbol, 500),
  });

  const histArr: CandleItem[] = hist ?? [];

  // ---- Bootstrap → series
  const bootCandles: CandlePoint[] = useMemo(
    () => histArr.map(b => ({ time: toUtc(b.ts), open: b.open, high: b.high, low: b.low, close: b.close })),
    [histArr]
  );
  const bootSma: LinePoint[] = useMemo(
    () => histArr.filter(b => b.sma10 != null).map(b => ({ time: toUtc(b.ts), value: b.sma10 as number })),
    [histArr]
  );
  const bootVols: VolumePoint[] = useMemo(
    () => histArr.map(b => ({
      time: toUtc(b.ts),
      value: b.volume,
      color: b.close >= b.open ? '#16a34a' : '#dc2626',
    })),
    [histArr]
  );

  // ---- Live buffers
  const [liveCandles, setLiveCandles] = useState<CandlePoint[]>([]);
  const [liveSma, setLiveSma] = useState<LinePoint[]>([]);
  const [liveVols, setLiveVols] = useState<VolumePoint[]>([]);

  useEffect(() => {
    setLiveCandles([]);
    setLiveSma([]);
    setLiveVols([]);
  }, [symbol]);

  const sseUrl = useMemo(
    () => (symbol ? `${REALTIME_URL}?symbol=${encodeURIComponent(symbol)}` : undefined),
    [symbol]
  );

  useSSE<SseTickMsg>(sseUrl, (msg) => {
    if (!msg || msg.symbol !== symbol) return;

    // prefer candle1m timestamp (ts or bucket_start); fallback to msg.ts
    const c1 = msg.candle1m;
    const rawTs = c1?.ts ?? c1?.bucket_start ?? msg.ts;
    const tNum =
      typeof rawTs === 'number' ? rawTs :
        typeof rawTs === 'string' ? Number(rawTs) : NaN;
    if (!Number.isFinite(tNum)) return; // drop bad events

    const t = toUtc(Math.floor(tNum));

    if (c1) {
      const c = {
        time: t,
        open: c1.open,
        high: c1.high,
        low: c1.low,
        close: c1.close,
      };
      setLiveCandles(prev => upsertAsc<typeof c>(prev, c));

      const v = {
        time: t,
        value: typeof c1.volume === 'number' ? c1.volume : (typeof msg.volume === 'number' ? msg.volume : 0),
        color: c.close >= c.open ? '#16a34a' : '#dc2626',
      };
      setLiveVols(prev => upsertAsc<typeof v>(prev, v));
    }

    if (typeof msg.sma10 === 'number') {
      const s = { time: t, value: msg.sma10 };
      setLiveSma(prev => upsertAsc<typeof s>(prev, s));
    }
  });

  // ---- Merge bootstrap + live (ASC, dedup by time)
  const mergedCandles = useMemo(() => {
    if (!bootCandles.length) return liveCandles;
    const map = new Map<number, CandlePoint>();
    for (const p of bootCandles) map.set(p.time as number, p);
    for (const p of liveCandles) map.set(p.time as number, p);
    return [...map.values()].sort((a, b) => (a.time as number) - (b.time as number));
  }, [bootCandles, liveCandles]);

  const mergedSma = useMemo(() => {
    const map = new Map<number, LinePoint>();
    for (const p of bootSma) map.set(p.time as number, p);
    for (const p of liveSma) map.set(p.time as number, p);
    return [...map.values()].sort((a, b) => (a.time as number) - (b.time as number));
  }, [bootSma, liveSma]);

  const mergedVols = useMemo(() => {
    const map = new Map<number, VolumePoint>();
    for (const p of bootVols) map.set(p.time as number, p);
    for (const p of liveVols) map.set(p.time as number, p);
    return [...map.values()].sort((a, b) => (a.time as number) - (b.time as number));
  }, [bootVols, liveVols]);

  if (loadingSymbols || booting) return <Loading label="Loading dashboard..." />;

  return (
    // <section className="space-y-4">
    //   <div className="flex items-center gap-3">
    //     <h2 className="text-xl font-semibold">Dashboard</h2>
    //     <select
    //       value={symbol}
    //       onChange={(e) => setSymbol(e.target.value)}
    //       className="px-2 py-1 rounded border border-slate-300 bg-white text-sm"
    //     >
    //       {symbols.map((s: SymbolInfo) => (
    //         <option key={s.symbol} value={s.symbol}>
    //           {s.symbol}
    //         </option>
    //       ))}
    //     </select>
    //   </div>

    //   <LiveChart data={merged} symbol={symbol} />

    //   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    //     <div className="rounded border border-slate-200 bg-white p-3">
    //       <div className="text-xs text-slate-500 mb-1">Realtime URL</div>
    //       <div className="font-mono text-xs break-all">{sseUrl || "—"}</div>
    //     </div>
    //     <div className="rounded border border-slate-200 bg-white p-3">
    //       <div className="text-xs text-slate-500 mb-1">Last tick</div>
    //       <div className="font-mono text-xs">
    //         {merged.length ? JSON.stringify(merged[merged.length - 1]) : "—"}
    //       </div>
    //     </div>
    //     <div className="rounded border border-slate-200 bg-white p-3">
    //       <div className="text-xs text-slate-500 mb-1">Points (history/live)</div>
    //       <div className="font-mono text-xs">
    //         {history.length} / {live.length}
    //       </div>
    //     </div>
    //   </div>
    // </section>
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="px-2 py-1 rounded border border-slate-300 bg-white text-sm"
        >
          {symList.map((s: SymbolInfo) => (
            <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
          ))}
        </select>
      </div>

      <LiveChart
        symbol={symbol}
        candles={mergedCandles}
        sma={mergedSma}
        volumes={mergedVols}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-1">Realtime URL</div>
          <div className="font-mono text-xs break-all">{sseUrl || '—'}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-1">Last candle</div>
          <div className="font-mono text-xs">
            {mergedCandles.length ? JSON.stringify(mergedCandles[mergedCandles.length - 1]) : '—'}
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-1">Points (candles/sma/vol)</div>
          <div className="font-mono text-xs">
            {mergedCandles.length} / {mergedSma.length} / {mergedVols.length}
          </div>
        </div>
      </div>
    </section>
  );
}