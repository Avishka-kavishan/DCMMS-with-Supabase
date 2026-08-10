import { NextResponse } from "next/server";
import { getDailyMailRecordsServer, saveDailyMailRecordServer, saveDailyMailToNewTableServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getDailyMailRecordsServer();
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saveRes = await saveDailyMailRecordServer(body);
    if (!saveRes.success) {
      return NextResponse.json({ error: saveRes.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: saveRes.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

