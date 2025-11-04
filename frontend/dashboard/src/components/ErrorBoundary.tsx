import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function ErrorBoundary() {
  const err = useRouteError();
  let title = "Something went wrong";
  let detail = "Unexpected application error";

  if (isRouteErrorResponse(err)) {
    title = `Error ${err.status}`;
    detail = err.statusText || detail;
  } else if (err instanceof Error) {
    detail = err.message;
  }

  return (
    <div className="mx-auto max-w-xl mt-16 p-6 rounded-lg bg-white border border-slate-200">
      <h1 className="text-lg font-semibold mb-2">{title}</h1>
      <p className="text-slate-600 text-sm">{detail}</p>
      <div className="mt-4">
        <a href="/" className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-sm">Go Home</a>
      </div>
    </div>
  );
}