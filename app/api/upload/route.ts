import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const refNo = (formData.get("refNo") as string) || "doc";

    if (!file) {
      return NextResponse.json({ error: "No file attached" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Limit to 25MB
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 25MB limit" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Target folder: public/uploads/documents/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    await mkdir(uploadDir, { recursive: true });

    // Generate safe unique filename
    const cleanRef = refNo.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const cleanOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${cleanRef}_${Date.now()}_${cleanOriginalName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    // Write file to disk
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/documents/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      documentUrl: publicUrl,
      documentName: file.name,
      documentSize: file.size,
    });
  } catch (error: any) {
    console.error("Local file upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
