import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { created_date: "desc" },
      include: {
        person: true,
        school: true,
        currentStatus: true,
      },
    });
    return NextResponse.json({ success: true, data: cases });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newCase = await prisma.case.create({
      data: {
        case_number: body.case_number,
        subject_officer_id: body.subject_officer_id || undefined,
        school_id: body.school_id || undefined,
        person_id: body.person_id || undefined,
        current_status_id: body.current_status_id || 1,
        secretary_approval: body.secretary_approval ?? false,
        approval_date: body.approval_date ? new Date(body.approval_date) : undefined,
        complaint_summary: body.complaint_summary || body.complaint_description || undefined,
      },
    });
    return NextResponse.json({ success: true, data: newCase });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

