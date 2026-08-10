import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mailRecords = await prisma.dcmmsDailyMail.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ success: true, data: mailRecords });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newMail = await prisma.dcmmsDailyMail.create({
      data: {
        serial_no: body.serial_no,
        received_date: body.received_date ? new Date(body.received_date) : undefined,
        letter_no: body.letter_no,
        submitted_date: body.submitted_date ? new Date(body.submitted_date) : undefined,
        subject: body.subject,
        sender: body.sender,
        method: body.method,
        type: body.type,
        classification: body.classification,
        action_officer: body.action_officer,
        status: body.status || "Pending",
      },
    });
    return NextResponse.json({ success: true, data: newMail });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
