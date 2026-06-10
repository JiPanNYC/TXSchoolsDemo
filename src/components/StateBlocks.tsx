import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading data" }: { label?: string }) {
  return (
    <div className="surface flex min-h-40 items-center justify-center gap-3 p-6 text-sm font-semibold text-slate-600">
      <Loader2
        aria-hidden="true"
        className="h-5 w-5 animate-spin text-public-blue-700"
      />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">Unable to load data</p>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          {onRetry ? (
            <button className="btn-secondary mt-4" type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title = "No records found",
  description = "Adjust the search or filters and try again."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="surface flex min-h-48 flex-col items-center justify-center p-8 text-center">
      <Inbox aria-hidden="true" className="h-8 w-8 text-slate-400" />
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
    </div>
  );
}
