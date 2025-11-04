export default function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600 text-sm">
      <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-pulse"></span>
      {label}
    </div>
  );
}