// law_web/app/law/[lawkey]/page.tsx

import React from "react";

async function getLawDetail(lawKey: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/law/${lawKey}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("법령 상세 조회 실패");
  }

  return res.json();
}

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
  const data = await getLawDetail(lawKey);

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
          <div className="mt-10 mb-6">
            <h2 className="text-base font-semibold tracking-tight text-zinc-500">
              {pendingChapterTitle}
            </h2>
            <div className="mt-1 border-b border-zinc-500" />
          </div>
        )}

        <article
          key={article.id}
          id={article.full_path}
        >
          <div className="mb-6">
            <h3 className="text-xl font-semibold">
              {article.full_path}  {article.article_title ? `${article.article_title}` : ""}
            </h3>
          </div>

          {shouldShowArticleText && (
            <p className="mb-4 whitespace-pre-wrap leading-7 text-zinc-800">
              {renderAmendmentText(cleanedText)}
            </p>
          )}

          {article.direct_items?.length > 0 && (
            <div className="space-y-6 pl-4">
              {article.direct_items.map((item: any) => (
                <div key={item.id}>
                  <p className="whitespace-pre-wrap leading-7">
                    {item.item_text}
                  </p>

                  {item.subitems?.length > 0 && (
                    <div className="mt-2 space-y-2 pl-6">
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

          {article.paragraphs?.length > 0 && (
            <div className="space-y-16">
              {article.paragraphs.map((para: any) => (
                <div key={para.id} className="pl-2">
                  <p className="whitespace-pre-wrap leading-7 text-zinc-800">
                    {renderAmendmentText(para.paragraph_text)}
                  </p>

                  {para.items?.length > 0 && (
                    <div className="mt-6 space-y-6 pl-6">
                      {para.items.map((item: any) => (
                        <div key={item.id}>
                          <p className="whitespace-pre-wrap leading-7 text-zinc-700">
                            {item.item_text}
                          </p>

                          {item.subitems?.length > 0 && (
                            <div className="mt-2 space-y-2 pl-6">
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
                    {article.article_reference && (
            <p className="mt-4 whitespace-pre-wrap text-base text-zinc-400">
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
