import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "data", "default_system_prompt.txt");
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ prompt: content });
  } catch (error) {
    console.error("Error reading default system prompt:", error);
    return NextResponse.json(
      { prompt: "" },
      { status: 500 }
    );
  }
}

