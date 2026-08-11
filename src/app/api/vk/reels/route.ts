import { NextRequest, NextResponse } from "next/server";
import { vkReels, vkVideos, isVkConfigured } from "@/lib/vk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Короткие видео (рилс) и обычные клипы из VK.
 * ?mode=reels — до 60 секунд
 * ?mode=videos — от 60 секунд
 */
export async function GET(request: NextRequest) {
  if (!isVkConfigured()) {
    return NextResponse.json({ error: "VK не настроен", videos: [] }, { status: 503 });
  }

  const p = request.nextUrl.searchParams;
  const mode = p.get("mode") || "reels";
  const q = (p.get("q") || "").trim();
  const count = Math.min(Number(p.get("count") || 24), 40);

  try {
    const videos =
      mode === "videos" ? await vkVideos(q || "клип", count) : await vkReels(q, count);
    return NextResponse.json({ videos, total: videos.length, mode });
  } catch (error) {
    console.error("VK reels error:", error);
    return NextResponse.json({ error: "Ошибка запроса к VK", videos: [] }, { status: 502 });
  }
}
