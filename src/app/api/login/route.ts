import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import db from "@/lib/db";

const secret = new TextEncoder().encode(process.env.SECRET_KEY || "change_this_to_a_strong_secret");

export async function POST(req: NextRequest) {
  const { voter_id, password } = await req.json();

  if (!voter_id || !password) {
    return NextResponse.json({ message: "voter_id and password are required" }, { status: 400 });
  }

  const voter = db
    .prepare("SELECT role FROM voters WHERE voter_id = ? AND password = ?")
    .get(voter_id, password) as { role: string } | undefined;

  if (!voter) {
    return NextResponse.json({ message: "Invalid Voter ID or password" }, { status: 401 });
  }

  const token = await new SignJWT({ voter_id, role: voter.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const res = NextResponse.json({ role: voter.role });
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });

  return res;
}
