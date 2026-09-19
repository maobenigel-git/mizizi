import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted">That page does not exist, or has moved.</p>
      <Link href="/today" className="rounded-xl bg-accent-solid px-6 py-3 font-semibold text-white">
        Back to Home
      </Link>
    </div>
  );
}
