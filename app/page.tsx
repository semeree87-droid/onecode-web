//law_web/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-3xl font-bold">국가법령 검색 테스트</h1>

      <p className="mb-8 text-zinc-600">
        아래 버튼을 누르면 법령 목록 페이지로 이동합니다.
      </p>

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