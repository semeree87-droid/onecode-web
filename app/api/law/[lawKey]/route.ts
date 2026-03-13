import { NextResponse } from "next/server";
import { getLawDetailFromDb } from "@/lib/law-detail";

type RouteContext = {
  params: Promise<{ lawKey: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { lawKey } = await context.params;
    const data = await getLawDetailFromDb(lawKey);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "법령 상세 조회 실패" },
      { status: 500 }
    );
  }
}