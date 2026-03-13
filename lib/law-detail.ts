import { supabase } from "@/lib/supabase";

export async function getLawDetailFromDb(lawKey: string) {
  // 1) 법령 기본정보
  const { data: law, error: lawError } = await supabase
    .from("laws")
    .select("*")
    .eq("law_key", lawKey)
    .single();

  if (lawError || !law) {
    throw new Error("법령을 찾을 수 없습니다.");
  }

  // 2) 조문
  const { data: articles, error: articlesError } = await supabase
    .from("law_articles")
    .select("*")
    .eq("law_id", law.id)
    .order("sort_no", { ascending: true });

  if (articlesError) {
    throw new Error("조문 조회 실패");
  }

  const articleIds = (articles ?? []).map((a) => a.id);

  // 3) 항
  let paragraphs: any[] = [];
  if (articleIds.length > 0) {
    const { data, error } = await supabase
      .from("law_paragraphs")
      .select("*")
      .in("article_id", articleIds)
      .order("sort_no", { ascending: true });

    if (error) {
      throw new Error("항 조회 실패");
    }
    paragraphs = data ?? [];
  }

  const paragraphIds = paragraphs.map((p) => p.id);

  // 4) 호
  let items: any[] = [];
  if (articleIds.length > 0) {
    const { data, error } = await supabase
      .from("law_items")
      .select("*")
      .in("article_id", articleIds)
      .order("sort_no", { ascending: true });

    if (error) {
      throw new Error("호 조회 실패");
    }
    items = data ?? [];
  }

  const itemIds = items.map((i) => i.id);

  // 5) 목
  let subitems: any[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from("law_subitems")
      .select("*")
      .in("item_id", itemIds)
      .order("sort_no", { ascending: true });

    if (error) {
      throw new Error("목 조회 실패");
    }
    subitems = data ?? [];
  }

  // 6) 부칙
  const { data: addenda, error: addendaError } = await supabase
    .from("law_addenda")
    .select("*")
    .eq("law_id", law.id)
    .order("sort_no", { ascending: true });

  if (addendaError) {
    throw new Error("부칙 조회 실패");
  }

  // 7) 개정문 / 제개정이유
  const { data: notes, error: notesError } = await supabase
    .from("law_revision_notes")
    .select("*")
    .eq("law_id", law.id)
    .order("id", { ascending: true });

  if (notesError) {
    throw new Error("개정문/제개정이유 조회 실패");
  }

  // -----------------------------
  // 계층 구조 조립
  // -----------------------------
  const subitemsByItemId = new Map<number, any[]>();
  for (const sub of subitems) {
    const arr = subitemsByItemId.get(sub.item_id) ?? [];
    arr.push(sub);
    subitemsByItemId.set(sub.item_id, arr);
  }

  const itemsByParagraphId = new Map<number, any[]>();
  const directItemsByArticleId = new Map<number, any[]>();

  for (const item of items) {
    const enrichedItem = {
      ...item,
      subitems: subitemsByItemId.get(item.id) ?? [],
    };

    if (item.paragraph_id) {
      const arr = itemsByParagraphId.get(item.paragraph_id) ?? [];
      arr.push(enrichedItem);
      itemsByParagraphId.set(item.paragraph_id, arr);
    } else {
      const arr = directItemsByArticleId.get(item.article_id) ?? [];
      arr.push(enrichedItem);
      directItemsByArticleId.set(item.article_id, arr);
    }
  }

  const paragraphsByArticleId = new Map<number, any[]>();
  for (const para of paragraphs) {
    const enrichedPara = {
      ...para,
      items: itemsByParagraphId.get(para.id) ?? [],
    };

    const arr = paragraphsByArticleId.get(para.article_id) ?? [];
    arr.push(enrichedPara);
    paragraphsByArticleId.set(para.article_id, arr);
  }

  const enrichedArticles = (articles ?? []).map((article) => ({
    ...article,
    direct_items: directItemsByArticleId.get(article.id) ?? [],
    paragraphs: paragraphsByArticleId.get(article.id) ?? [],
  }));

  return {
    law,
    articles: enrichedArticles,
    addenda: addenda ?? [],
    notes: notes ?? [],
  };
}