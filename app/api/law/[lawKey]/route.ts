  // law_web/app/api/law/[lawkey]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ lawKey: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { lawKey } = await context.params;

  // 1) 법령 기본정보
  const { data: law, error: lawError } = await supabase
    .from("laws")
    .select("*")
    .eq("law_key", lawKey)
    .single();

  if (lawError || !law) {
    return NextResponse.json(
      { error: "법령을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 2) 조문
  const { data: articles, error: articlesError } = await supabase
    .from("law_articles")
    .select("*")
    .eq("law_id", law.id)
    .order("sort_no", { ascending: true });

  if (articlesError) {
    return NextResponse.json(
      { error: "조문 조회 실패", detail: articlesError.message },
      { status: 500 }
    );
  }

  const articleIds = (articles ?? []).map((a) => a.id);

  // article가 없을 수도 있으니 방어
  let paragraphs: any[] = [];
  let items: any[] = [];
  let subitems: any[] = [];

  if (articleIds.length > 0) {
    const { data: paragraphRows, error: paragraphsError } = await supabase
      .from("law_paragraphs")
      .select("*")
      .in("article_id", articleIds)
      .order("sort_no", { ascending: true });

    if (paragraphsError) {
      return NextResponse.json(
        { error: "항 조회 실패", detail: paragraphsError.message },
        { status: 500 }
      );
    }

    paragraphs = paragraphRows ?? [];
    const paragraphIds = paragraphs.map((p) => p.id);

    const { data: itemRows, error: itemsError } = await supabase
      .from("law_items")
      .select("*")
      .in("article_id", articleIds)
      .order("sort_no", { ascending: true });

    if (itemsError) {
      return NextResponse.json(
        { error: "호 조회 실패", detail: itemsError.message },
        { status: 500 }
      );
    }

    items = itemRows ?? [];
    const itemIds = items.map((i) => i.id);

    if (itemIds.length > 0) {
      const { data: subitemRows, error: subitemsError } = await supabase
        .from("law_subitems")
        .select("*")
        .in("item_id", itemIds)
        .order("sort_no", { ascending: true });

      if (subitemsError) {
        return NextResponse.json(
          { error: "목 조회 실패", detail: subitemsError.message },
          { status: 500 }
        );
      }

      subitems = subitemRows ?? [];
    }
  }

  // 3) 부칙
  const { data: addenda, error: addendaError } = await supabase
    .from("law_addenda")
    .select("*")
    .eq("law_id", law.id)
    .order("sort_no", { ascending: true });

  if (addendaError) {
    return NextResponse.json(
      { error: "부칙 조회 실패", detail: addendaError.message },
      { status: 500 }
    );
  }

  // 4) 개정문 / 제개정이유
  const { data: notes, error: notesError } = await supabase
    .from("law_revision_notes")
    .select("*")
    .eq("law_id", law.id);

  if (notesError) {
    return NextResponse.json(
      { error: "개정문 조회 실패", detail: notesError.message },
      { status: 500 }
    );
  }

  // 5) 계층 구조 조립
  const subitemsByItemId = new Map<number, any[]>();
  for (const subitem of subitems) {
    const arr = subitemsByItemId.get(subitem.item_id) ?? [];
    arr.push(subitem);
    subitemsByItemId.set(subitem.item_id, arr);
  }

  const itemsByParagraphId = new Map<number, any[]>();
  const directItemsByArticleId = new Map<number, any[]>();

  for (const item of items) {
    const itemWithChildren = {
      ...item,
      subitems: subitemsByItemId.get(item.id) ?? [],
    };

    if (item.paragraph_id) {
      const arr = itemsByParagraphId.get(item.paragraph_id) ?? [];
      arr.push(itemWithChildren);
      itemsByParagraphId.set(item.paragraph_id, arr);
    } else {
      const arr = directItemsByArticleId.get(item.article_id) ?? [];
      arr.push(itemWithChildren);
      directItemsByArticleId.set(item.article_id, arr);
    }
  }

  const paragraphsByArticleId = new Map<number, any[]>();
  for (const para of paragraphs) {
    const paraWithItems = {
      ...para,
      items: itemsByParagraphId.get(para.id) ?? [],
    };

    const arr = paragraphsByArticleId.get(para.article_id) ?? [];
    arr.push(paraWithItems);
    paragraphsByArticleId.set(para.article_id, arr);
  }

  const nestedArticles = (articles ?? []).map((article) => ({
    ...article,
    paragraphs: paragraphsByArticleId.get(article.id) ?? [],
    direct_items: directItemsByArticleId.get(article.id) ?? [],
  }));

  return NextResponse.json({
    law,
    articles: nestedArticles,
    addenda: addenda ?? [],
    notes: notes ?? [],
  });
}