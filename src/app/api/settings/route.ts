import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

const MONOBANK_TOKEN_KEY = "monobank_token";
const MONOBANK_CARD_KEY = "monobank_card";
const APP_URL_KEY = "app_url";
const LESSON_PRICE_KEY = "lesson_price";

export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.settings.findMany({
    where: { key: { in: [MONOBANK_TOKEN_KEY, MONOBANK_CARD_KEY, APP_URL_KEY, LESSON_PRICE_KEY] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    hasMonobankToken: !!map[MONOBANK_TOKEN_KEY],
    monobankCard: map[MONOBANK_CARD_KEY] ?? "",
    appUrl: map[APP_URL_KEY] ?? "",
    lessonPrice: map[LESSON_PRICE_KEY] ? parseInt(map[LESSON_PRICE_KEY], 10) / 100 : "",
  });
}

export async function POST(request: NextRequest) {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, monobankToken, monobankCard, appUrl, lessonPrice } =
    (body as Record<string, unknown>) ?? {};

  // Save settings
  if (action === "save") {
    const updates: { key: string; value: string }[] = [];

    if (typeof monobankToken === "string" && monobankToken.trim()) {
      updates.push({ key: MONOBANK_TOKEN_KEY, value: monobankToken.trim() });
    }
    if (typeof monobankCard === "string") {
      updates.push({ key: MONOBANK_CARD_KEY, value: monobankCard.trim() });
    }
    if (typeof appUrl === "string") {
      updates.push({ key: APP_URL_KEY, value: appUrl.trim() });
    }
    if (typeof lessonPrice === "number" && lessonPrice > 0) {
      // Store in kopecks
      updates.push({ key: LESSON_PRICE_KEY, value: String(Math.round(lessonPrice * 100)) });
    } else if (lessonPrice === "" || lessonPrice === 0) {
      // Clear lesson price
      await prisma.settings.deleteMany({ where: { key: LESSON_PRICE_KEY } });
    }

    for (const { key, value } of updates) {
      await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ ok: true });
  }

  // Register webhook with Monobank
  if (action === "registerWebhook") {
    const tokenRow = await prisma.settings.findUnique({ where: { key: MONOBANK_TOKEN_KEY } });
    const urlRow = await prisma.settings.findUnique({ where: { key: APP_URL_KEY } });

    if (!tokenRow?.value) {
      return NextResponse.json({ error: "Monobank token not saved yet" }, { status: 400 });
    }
    if (!urlRow?.value) {
      return NextResponse.json({ error: "App URL not saved yet" }, { status: 400 });
    }

    const webhookUrl = `${urlRow.value.replace(/\/$/, "")}/api/monobank/webhook`;

    const res = await fetch("https://api.monobank.ua/personal/webhook", {
      method: "POST",
      headers: {
        "X-Token": tokenRow.value,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webHookUrl: webhookUrl }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Monobank API error: ${text}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, webhookUrl });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
