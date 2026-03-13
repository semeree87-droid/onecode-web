//law_web/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-3xl font-bold">OneCode</h1>
      <div className="flex flex-col gap-4">
        <Link
          href="/law"
          className="rounded-lg bg-black px-6 py-3 text-white hover:bg-zinc-800"
        >
          법령 목록 보러가기
        </Link>
      </div>
    </main>
  );
}