import { NextResponse } from "next/server";
import { getRegisterOfficersServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;
    const res = await getRegisterOfficersServer(role);
    if (!res.success) {
      return NextResponse.json({ error: res.error, data: [] }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }
}
