import { NextResponse } from "next/server";
import { signOutUser } from "@/lib/auth-service";

export async function POST() {
  await signOutUser();
  return NextResponse.json({ success: true, message: "Signed out successfully." }, { status: 200 });
}
