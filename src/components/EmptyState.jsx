import { Link } from "react-router-dom";

export default function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  variant = "default",
}) {
  const tone =
    variant === "warning"
      ? "border-yellow-700 bg-yellow-950/40 text-yellow-100"
      : variant === "danger"
      ? "border-red-800 bg-red-950/40 text-red-100"
      : "border-gray-700 bg-gray-950 text-gray-300";
  const actionClass =
    variant === "warning"
      ? "bg-yellow-300 text-black hover:bg-yellow-200"
      : variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-white text-black hover:bg-gray-200";

  const action =
    actionLabel && actionTo ? (
      <Link
        to={actionTo}
        className={`mt-5 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${actionClass}`}
      >
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className={`mt-5 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${actionClass}`}
      >
        {actionLabel}
      </button>
    ) : null;

  return (
    <div className={`rounded-3xl border border-dashed p-8 text-center sm:p-10 ${tone}`}>
      {eyebrow && <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{eyebrow}</p>}
      <p className="mx-auto mt-2 max-w-xl text-lg font-semibold text-white">{title}</p>
      {description && (
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
