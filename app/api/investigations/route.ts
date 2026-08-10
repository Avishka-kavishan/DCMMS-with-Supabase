import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const investigations = await prisma.investigation.findMany({
      orderBy: { assigned_date: "desc" },
    });
    return NextResponse.json({ success: true, data: investigations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inv = await prisma.investigation.create({
      data: {
        case_id: body.case_id,
        investigation_type: body.investigation_type,
        investigation_no: body.investigation_no,
        assigned_date: body.assigned_date ? new Date(body.assigned_date) : undefined,
        due_date: body.due_date ? new Date(body.due_date) : undefined,
        report_received_date: body.report_received_date ? new Date(body.report_received_date) : undefined,
        extension_days: body.extension_days,
        recommendation: body.recommendation,
        approval_date: body.approval_date ? new Date(body.approval_date) : undefined,
        next_action: body.next_action,
        status: body.status || "Ongoing",
      },
    });
    return NextResponse.json({ success: true, data: inv });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
