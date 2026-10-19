export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="border border-dashed border-[#ccc] bg-white p-8 text-center">
      <p className="text-sm font-medium text-[#555]">{title}</p>
      {message ? <p className="mt-1 text-xs text-[#888]">{message}</p> : null}
    </div>
  );
}
