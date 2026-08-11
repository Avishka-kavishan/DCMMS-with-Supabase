import { NextResponse } from "next/server";
import { getInstitutesServer, saveInstituteServer, deleteInstituteServer } from "@/lib/db-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getInstitutesServer();
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
    const res = await saveInstituteServer(body);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }
    const res = await deleteInstituteServer(id);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
