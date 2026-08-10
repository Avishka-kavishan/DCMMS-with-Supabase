import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const profile = await prisma.dcmmsProfile.findUnique({
      where: { username },
    });

    if (!profile) {
      // Create user profile if first time local intranet access
      const newProfile = await prisma.dcmmsProfile.create({
        data: {
          username,
          full_name: username,
          role: "System Administrator",
        },
      });
      return NextResponse.json({ success: true, user: newProfile });
    }

    return NextResponse.json({ success: true, user: profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Authentication failed" }, { status: 500 });
  }
}
