import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";

const MONOBANK_TOKEN_KEY = "monobank_token";
const MONOBANK_CARD_KEY = "monobank_card";
const APP_URL_KEY = "app_url";
const LESSON_PRICE_KEY = "lesson_price";

function getAppUrl(request: NextRequest): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "";
}

export async function GET(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.settings.findMany({
    where: { key: { in: [MONOBANK_TOKEN_KEY, MONOBANK_CARD_KEY, APP_URL_KEY, LESSON_PRICE_KEY] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const appUrlFromDb = map[APP_URL_KEY] ?? "";
  const appUrl = appUrlFromDb || getAppUrl(request);

  return NextResponse.json({
    hasMonobankToken: !!map[MONOBANK_TOKEN_KEY],
    monobankCard: map[MONOBANK_CARD_KEY] ?? "",
    appUrl,
    lessonPrice: map[LESSON_PRICE_KEY] ? parseInt(map[LESSON_PRICE_KEY], 10) / 100 : "",
  });
}

export async function POST(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const appUrl = urlRow?.value?.trim() || getAppUrl(request);

    if (!tokenRow?.value) {
      return NextResponse.json({ error: "Monobank token not saved yet" }, { status: 400 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "App URL not set. Save it in Settings or set APP_URL in .env" }, { status: 400 });
    }

    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/monobank/webhook`;

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
