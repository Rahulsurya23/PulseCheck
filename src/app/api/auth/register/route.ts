import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    console.error(
      "Register error: SUPABASE_SERVICE_ROLE_KEY is missing or still contains a placeholder"
    );
    return NextResponse.json(
      {
        error:
          "Account creation is not configured. Set a valid SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the app.",
      },
      { status: 503 }
    );
  }

  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const password_hash = await hashPassword(password);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({ email, password_hash, name: name || null })
      .select("id, email, name")
      .single();

    if (error) throw error;

    const token = generateToken(user.id);
    return NextResponse.json({ user, token }, { status: 201 });
  } catch (err) {
    console.error("Register error:", err);
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "PGRST205"
    ) {
      return NextResponse.json(
        {
          error:
            "The Supabase users table is missing. Run supabase/migrations/001_create_users.sql in your Supabase SQL Editor, then try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}