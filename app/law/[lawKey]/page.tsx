// law_web/app/law/[lawkey]/page.tsx

import React from "react";
import { getLawDetailFromDb } from "@/lib/law-detail";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanArticleText(article: any) {
  if (!article.article_text) return "";

  const text = String(article.article_text).trim();
  const fullPath = String(article.full_path ?? "").trim();
  const title = String(article.article_title ?? "").trim();

  if (!text) return "";

  // 1) "제1조(정의)" 형태만 정확히 앞에서 제거
  if (fullPath && title) {
    const exactPrefix = `${fullPath}(${title})`;
    if (text.startsWith(exactPrefix)) {
      return text.slice(exactPrefix.length).trim();
    }
  }

  // 2) "제1조 정의" 처럼 저장된 경우만 제거
  if (fullPath && title) {
    const loosePrefix = `${fullPath} ${title}`;
    if (text.startsWith(loosePrefix)) {
      return text.slice(loosePrefix.length).trim();
    }
  }

  // 3) full_path만 단독으로 있는 경우 제거
  // 단, 뒤에 바로 <...> 나 [...] 같은 부가표시가 오는 경우는 건드리지 않음
  if (fullPath) {
    const after = text.slice(fullPath.length);
    const startsWithMeta =
      after.startsWith("<") || after.startsWith("[") || after.startsWith("【");

    if (text.startsWith(fullPath) && !startsWithMeta) {
      return after.trim();
    }
  }

  return text;
}

function renderAmendmentText(text: string) {
  const parts = text.split(/(<(?:개정|신설|본조신설|삭제)[^>]*>)/g);

  return parts.map((part, i) => {
    if (/^<(?:개정|신설|본조신설|삭제)[^>]*>$/.test(part)) {
      return (
        <span key={i} className="text-zinc-400">
          {part}
        </span>
      );
    }
    return part;
  });
}

function extractChapterTitle(text: string) {
  if (!text) return null;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^제\s*\d+\s*장/.test(line) || /^제[0-9]+장/.test(line)) {
      return line.replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  return date.replaceAll("-", ".");
}



type PageProps = {
  params: Promise<{ lawKey: string }>;
};

export default async function LawDetailPage({ params }: PageProps) {
  const { lawKey } = await params;
  const data = await getLawDetailFromDb(lawKey);

  const { law, articles, addenda, notes } = data;

  const amendmentNote = notes.find(
    (n: any) => n.note_type === "amendment_text"
  );

  const revisionReason = notes.find(
    (n: any) => n.note_type === "revision_reason"
  );

  const articleBlocks: React.ReactNode[] = [];
  let pendingChapterTitle: string | null = null;
  let lastRenderedChapterTitle: string | null = null;

  for (const article of articles) {
    const fullPath = String(article.full_path ?? "").trim();
    const isPreamble = fullPath.startsWith("전문-");

    // 전문-* 이면 장 제목만 추출해서 저장하고 화면에는 렌더링 안 함
    if (isPreamble) {
      const extracted = extractChapterTitle(String(article.article_text ?? ""));
      if (extracted) {
        pendingChapterTitle = extracted;
      }
      continue;
    }

    const cleanedText = cleanArticleText(article);
    const headingText = `${article.full_path}(${article.article_title ?? ""})`;

    const shouldShowArticleText =
      !!cleanedText &&
      cleanedText !== article.full_path &&
      cleanedText !== headingText;

    const shouldShowChapterTitle =
      !!pendingChapterTitle &&
      pendingChapterTitle !== lastRenderedChapterTitle;

    articleBlocks.push(
      <React.Fragment key={`wrap-${article.id}`}>
        {shouldShowChapterTitle && (
          // 장(Chapter) 제목 블록
          <div className="mt-10 mb-6">
            {/* mt-10 = 위쪽 여백 (이전 조문과 장 제목 사이 간격)
                mb-6  = 장 제목과 다음 조문 사이 간격 */}
            <h2 className="text-base font-semibold tracking-tight text-zinc-500">
              {pendingChapterTitle}
            </h2>

            {/* 장 제목 밑줄과 제목 사이 간격 */}
            <div className="mt-1 border-b border-zinc-500" />
            {/* mt-1 = 장 제목과 밑줄 사이 간격 */}
          </div>
        )}

        <article
          key={article.id}
          id={article.full_path}
        >
          {/* 조문 제목 */}
          <div className="mb-6">
            {/* mb-6 = 조문 제목과 조문 본문 사이 간격 */}
            <h3 className="text-xl font-semibold">
              {article.full_path}  {article.article_title ? `${article.article_title}` : ""}
            </h3>
          </div>

          {/* 조문 본문 */}
          {shouldShowArticleText && (
            <p className="mb-4 whitespace-pre-wrap leading-7 text-zinc-800">
              {/* mb-4 = 조문 본문과 다음 블록(항/호) 사이 간격 */}
              {/* leading-7 = 줄 간격 */}
              {renderAmendmentText(cleanedText)}
            </p>
          )}

          {/* 조문 바로 아래 호(① 없이 바로 1. 이런 경우) */}
          {article.direct_items?.length > 0 && (
            <div className="space-y-6 pl-4">
              {/* space-y-6 = 호 ↔ 호 사이 세로 간격 */}
              {/* pl-4 = 조문 본문 대비 들여쓰기 */}

              {article.direct_items.map((item: any) => (
                <div key={item.id}>
                  <p className="whitespace-pre-wrap leading-7">
                    {item.item_text}
                  </p>

                  {item.subitems?.length > 0 && (
                    <div className="mt-2 space-y-2 pl-6">
                      {/* mt-2 = 호와 목 사이 간격 */}
                      {/* space-y-2 = 목 ↔ 목 사이 간격 */}
                      {/* pl-6 = 목 들여쓰기 */}

                      {item.subitems.map((sub: any) => (
                        <p
                          key={sub.id}
                          className="whitespace-pre-wrap leading-7 text-zinc-700"
                        >
                          {sub.subitem_text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 항 구조 */}
          {article.paragraphs?.length > 0 && (
            <div className="space-y-16">
              {/* space-y-16 = 항(①②③) ↔ 항 사이 간격 */}

              {article.paragraphs.map((para: any) => (
                <div key={para.id} className="pl-2">
                  {/* pl-2 = 조문 본문 대비 항 들여쓰기 */}

                  <p className="whitespace-pre-wrap leading-7 text-zinc-800">
                    {/* leading-7 = 항 내부 줄 간격 */}
                    {renderAmendmentText(para.paragraph_text)}
                  </p>

                  {para.items?.length > 0 && (
                    <div className="mt-6 space-y-6 pl-6">
                      {/* mt-6 = 항과 호 사이 간격 */}
                      {/* space-y-6 = 호 ↔ 호 사이 간격 */}
                      {/* pl-6 = 호 들여쓰기 */}

                      {para.items.map((item: any) => (
                        <div key={item.id}>
                          <p className="whitespace-pre-wrap leading-7 text-zinc-700">
                            {item.item_text}
                          </p>

                          {item.subitems?.length > 0 && (
                            <div className="mt-2 space-y-2 pl-6">
                              {/* mt-2 = 호와 목 사이 간격 */}
                              {/* space-y-2 = 목 ↔ 목 사이 간격 */}
                              {/* pl-6 = 목 들여쓰기 */}

                              {item.subitems.map((sub: any) => (
                                <p
                                  key={sub.id}
                                  className="whitespace-pre-wrap leading-7 text-zinc-600"
                                >
                                  {sub.subitem_text}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 조문 끝에 붙는 <개정> <본조신설> 같은 문구 */}
          {article.article_reference && (
            <p className="mt-4 whitespace-pre-wrap text-base text-zinc-400">
              {/* mt-4 = 조문 마지막 내용과 개정표시 사이 간격 */}
              {article.article_reference}
            </p>
          )}
        </article>
      </React.Fragment>
    );

    if (shouldShowChapterTitle) {
      lastRenderedChapterTitle = pendingChapterTitle;
      pendingChapterTitle = null;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 pb-6">
        <h1 className="text-3xl font-bold">[법] {law.name_ko}</h1>
        <div className="mt-4 space-y-1 text-sm text-zinc-600">
          <p className="flex items-center gap-2 text-sm text-zinc-600">
            <span>{law.ministry_name ?? "-"}</span>
            <span className="text-zinc-400">|</span>
            <span>법률 제{law.promulgation_no ?? "-"}호</span>
          </p>
          <p>
          시행 {formatDate(law.enforcement_date)} 
          ({formatDate(law.promulgation_date)}, {law.revision_type ?? "-"})
        </p>
        </div>
      </header>

      <section className="mb-12">
        <div className="space-y-16">{articleBlocks}</div>
      </section>

      {addenda.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">부칙</h2>
          <div className="space-y-6">
            {addenda.map((row: any) => (
              <div
                key={row.id}
                className="rounded-xl border border-zinc-200 p-5"
              >
                <div className="mb-2 text-sm text-zinc-500">
                  공포번호: {row.promulgation_no ?? "-"} / 공포일자:{" "}
                  {row.promulgation_date ?? "-"}
                </div>
                <pre className="whitespace-pre-wrap font-sans leading-7 text-zinc-800">
                  {row.content}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}

      {amendmentNote && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">개정문</h2>
          <div className="rounded-xl border border-zinc-200 p-5">
            <pre className="whitespace-pre-wrap font-sans leading-7 text-zinc-800">
              {amendmentNote.content}
            </pre>
          </div>
        </section>
      )}

      {revisionReason && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">제개정이유</h2>
          <div className="rounded-xl border border-zinc-200 p-5">
            <pre className="whitespace-pre-wrap font-sans leading-7 text-zinc-800">
              {revisionReason.content}
            </pre>
          </div>
        </section>
      )}
    </main>
  );
}
