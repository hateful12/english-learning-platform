import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

const MONOBANK_TOKEN_KEY = "monobank_token";
const MONOBANK_CARD_KEY = "monobank_card";
const APP_URL_KEY = "app_url";

export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.settings.findMany({
    where: { key: { in: [MONOBANK_TOKEN_KEY, MONOBANK_CARD_KEY, APP_URL_KEY] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    hasMonobankToken: !!map[MONOBANK_TOKEN_KEY],
    monobankCard: map[MONOBANK_CARD_KEY] ?? "",
    appUrl: map[APP_URL_KEY] ?? "",
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

  const { action, monobankToken, monobankCard, appUrl } =
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
