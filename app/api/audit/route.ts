import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const log = await prisma.auditLog.create({
      data: {
        user_id: body.user_id || "system_user",
        action: body.action,
        table_name: body.table_name || null,
        record_id: body.record_id || null,
      },
    });
    return NextResponse.json({ success: true, data: log });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
