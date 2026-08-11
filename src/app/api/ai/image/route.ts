import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiImages } from "@/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { addXp } from "@/lib/levels";

export const dynamic = "force-dynamic";

/**
 * Генерация картинок через Pollinations — открытый сервис без ключей.
 * Сама картинка отдаётся по прямой ссылке, мы лишь собираем запрос
 * и храним историю генераций.
 */

export const STYLES: Record<string, { label: string; suffix: string; emoji: string }> = {
  none: { label: "Без стиля", suffix: ", high quality, detailed, masterpiece", emoji: "🎨" },
  realistic: { label: "Фотореализм", suffix: ", photorealistic, ultra detailed, 8k uhd, professional photography, sharp focus, natural lighting", emoji: "📷" },
  anime: { label: "Аниме", suffix: ", anime art style, studio ghibli inspired, cel shaded, vibrant colors, detailed background, masterpiece", emoji: "🌸" },
  cyberpunk: { label: "Киберпанк", suffix: ", cyberpunk aesthetic, neon lights, blade runner style, futuristic city, volumetric fog, cinematic lighting, highly detailed", emoji: "🌃" },
  oil: { label: "Масло", suffix: ", oil painting on canvas, classical fine art, visible brush strokes, rich textures, museum quality", emoji: "🖼" },
  pixel: { label: "Пиксель-арт", suffix: ", pixel art, 16-bit retro game sprite, crisp pixels, limited palette", emoji: "👾" },
  fantasy: { label: "Фэнтези", suffix: ", epic fantasy art, magical atmosphere, dramatic lighting, highly detailed, digital painting, artstation trending", emoji: "🐉" },
  minimal: { label: "Минимализм", suffix: ", minimalist design, flat vector illustration, clean simple shapes, limited color palette", emoji: "⬜" },
  poster: { label: "Постер", suffix: ", bold poster art, graphic design, striking composition, vivid colors", emoji: "📰" },
  d3: { label: "3D-рендер", suffix: ", 3d render, octane render, cinema4d, soft studio lighting, subsurface scattering, highly detailed", emoji: "🧊" },
  noir: { label: "Нуар", suffix: ", film noir style, black and white, high contrast, dramatic shadows, cinematic", emoji: "🎬" },
  water: { label: "Акварель", suffix: ", watercolor painting, soft washes, flowing pigments, artistic paper texture", emoji: "💧" },
};

/**
 * Русские запросы нейросеть понимает хуже английских.
 * Переводим через открытый MyMemory — качество картинки заметно растёт.
 */
async function toEnglish(text: string): Promise<string> {
  if (!/[а-яё]/i.test(text)) return text;
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=ru|en`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return text;
    const d = (await r.json()) as { responseData?: { translatedText?: string } };
    const out = d.responseData?.translatedText?.trim();
    return out && out.length > 1 ? out : text;
  } catch {
    return text;
  }
}

const SIZES: Record<string, { w: number; h: number }> = {
  square: { w: 1024, h: 1024 },
  wide: { w: 1280, h: 720 },
  tall: { w: 720, h: 1280 },
};

/** История генераций */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    const where = user
      ? eq(aiImages.userId, user.id)
      : and(eq(aiImages.guestKey, guestKey), isNull(aiImages.userId));

    const images = await db
      .select()
      .from(aiImages)
      .where(where)
      .orderBy(desc(aiImages.createdAt))
      .limit(40);

    return NextResponse.json({
      images,
      styles: Object.entries(STYLES).map(([k, v]) => ({ key: k, ...v })),
    });
  } catch (error) {
    console.error("AI list error:", error);
    return NextResponse.json({ images: [], styles: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const style = String(body.style || "none");
    const size = String(body.size || "square");

    if (prompt.length < 2) {
      return NextResponse.json({ error: "Опишите, что нарисовать" }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: "Описание слишком длинное" }, { status: 400 });
    }

    const st = STYLES[style] ?? STYLES.none;
    const dim = SIZES[size] ?? SIZES.square;
    const seed = Math.floor(Math.random() * 1_000_000);

    // Переводим на английский и усиливаем стилем
    const english = await toEnglish(prompt);
    const full = `${english}${st.suffix}`;

    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}` +
      `?width=${dim.w}&height=${dim.h}&seed=${seed}&nologo=true&enhance=true&model=flux`;

    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    const [saved] = await db
      .insert(aiImages)
      .values({
        userId: user?.id ?? null,
        guestKey: user ? null : guestKey,
        prompt: prompt.slice(0, 500),
        // Сохраняем и переведённый вариант — видно, что ушло в нейросеть
        url,
        style,
        width: dim.w,
        height: dim.h,
      })
      .returning();

    // Опыт за творчество
    const xp = await addXp(8);

    return NextResponse.json({ success: true, image: saved, xp });
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json({ error: "Не удалось создать картинку" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const user = await getCurrentUser();
    const guestKey = await getGuestKey();
    const owner = user ? eq(aiImages.userId, user.id) : eq(aiImages.guestKey, guestKey);

    await db.delete(aiImages).where(and(eq(aiImages.id, id), owner));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
