import { NextResponse } from "next/server";
import { getCommitteeOfficersWithSchoolsServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const position = searchParams.get("position") || undefined;
    const res = await getCommitteeOfficersWithSchoolsServer(position);
    if (!res.success) {
      return NextResponse.json({ error: res.error, data: [] }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }
}
