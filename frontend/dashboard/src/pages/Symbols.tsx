import { useQuery } from "@tanstack/react-query";
import { listSymbols } from "../api/symbols";
import type { SymbolInfo } from "../domain/types";
import Loading from "../components/Loading";

export default function Symbols() {
  const { data = [], isLoading, error } = useQuery<SymbolInfo[]>({
    queryKey: ["symbols"],
    queryFn: listSymbols,
  });

  if (isLoading) return <Loading label="Loading symbols..." />;
  if (error) return <p className="text-red-600 text-sm">Failed: {(error as Error).message}</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Symbols</h2>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2">Symbol</th>
              <th className="text-left px-3 py-2">Base</th>
              <th className="text-left px-3 py-2">Quote</th>
              <th className="text-left px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s: SymbolInfo) => (
              <tr key={s.symbol} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{s.symbol}</td>
                <td className="px-3 py-2 text-xs">{s.base}</td>
                <td className="px-3 py-2 text-xs">{s.quote}</td>
                <td className="px-3 py-2 text-xs">{s.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}