import { useQuery } from "@tanstack/react-query";
import { fetchReadiness } from "../api/health";
import Loading from "../components/Loading";

export default function Health() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["readiness"],
    queryFn: fetchReadiness,
  });

  if (isLoading) return <Loading label="Checking readiness..." />;
  if (error) return <p className="text-red-600 text-sm">Failed: {(error as Error).message}</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Health</h2>
      <div className="rounded border border-slate-200 bg-white p-4">
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </section>
  );
}