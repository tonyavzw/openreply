import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Read-only feed of recent funnel leads (DmLog rows) for external dashboards.
 * Built for Tony's Command Deck poller; same bearer auth as the other cron routes.
 * ?hours=24 (default 24, max 168) · returns newest first, capped at 50.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const hours = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("hours")) || 24, 1),
    168
  );

  const leads = await prisma.dmLog.findMany({
    where: {
      createdAt: { gt: new Date(Date.now() - hours * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      commenterName: true,
      matchedKeyword: true,
      status: true,
      createdAt: true,
      automation: { select: { name: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: leads.map((l) => ({
      commenter: l.commenterName ?? "(unknown)",
      keyword: l.matchedKeyword ?? "any-word",
      status: l.status,
      at: l.createdAt.toISOString(),
      campaign: l.automation.name,
    })),
  });
}
