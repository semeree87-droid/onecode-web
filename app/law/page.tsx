//law_web/app/law/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

async function getLaws() {
  const { data, error } = await supabase
    .from("laws")
    .select("id, law_key, name_ko, law_type_name, ministry_name")
    .order("id", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`법령 목록 조회 실패: ${error.message}`);
  }

  return data ?? [];
}

export default async function LawListPage() {
  const laws = await getLaws();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">법령 목록</h1>
        <p className="mt-2 text-sm text-zinc-600">
          법령을 클릭하면 상세 페이지로 이동합니다.
        </p>
      </header>

      {laws.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 p-6 text-zinc-600">
          조회된 법령이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {laws.map((law) => (
            <Link
              key={law.id}
              href={`/law/${law.law_key}`}
              className="block rounded-xl border border-zinc-200 p-5 transition hover:bg-zinc-50"
            >
              <div className="text-lg font-semibold text-zinc-900">
                {law.name_ko}
              </div>

              <div className="mt-2 text-sm text-zinc-600">
                <span>법종: {law.law_type_name ?? "-"}</span>
                <span className="mx-2">/</span>
                <span>소관부처: {law.ministry_name ?? "-"}</span>
              </div>

              <div className="mt-2 text-xs text-zinc-400">
                law_key: {law.law_key}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}