import { NextResponse } from "next/server";
import { saveAccusedOfficerServer, getAccusedOfficerByRefServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const refNumber = searchParams.get("ref_number") || searchParams.get("refNo") || searchParams.get("case_no");

    if (!refNumber) {
      return NextResponse.json({ error: "Missing ref_number parameter" }, { status: 400 });
    }

    const res = await getAccusedOfficerByRefServer(refNumber);
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
    const saveRes = await saveAccusedOfficerServer(body);

    if (!saveRes.success) {
      return NextResponse.json({ error: saveRes.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: saveRes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
