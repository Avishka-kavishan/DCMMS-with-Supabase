import { NextResponse } from "next/server";
import { saveReplyLetterDetailsServer, getReplyLetterDetailsByRefServer, getAllReplyLetterDetailsServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const refNumber = searchParams.get("ref_number") || searchParams.get("refNo") || searchParams.get("case_no") || searchParams.get("file_no");

    if (!refNumber) {
      const allRes = await getAllReplyLetterDetailsServer();
      if (!allRes.success) {
        return NextResponse.json({ error: allRes.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: allRes.data });
    }

    const res = await getReplyLetterDetailsByRefServer(refNumber);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saveRes = await saveReplyLetterDetailsServer(body);

    if (!saveRes.success) {
      return NextResponse.json({ error: saveRes.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: saveRes });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
