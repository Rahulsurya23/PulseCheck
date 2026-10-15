import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type CreateStatusPageBody = {
  title: string;
  slug: string;
  description: string | null;
  endpoint_ids: string[];
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function migrationRequired() {
  return NextResponse.json(
    {
      error:
        "Status page tables are missing. Run supabase/migrations/004_create_status_pages.sql in your Supabase SQL Editor.",
    },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pages, error } = await supabaseAdmin
    .from("status_pages")
    .select("id, user_id, slug, title, description, is_public, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("List status pages error:", error);
    if (error.code === "PGRST205") return migrationRequired();
    return NextResponse.json(
      { error: "Failed to retrieve status pages" },
      { status: 500 }
    );
  }

  if (!pages?.length) return NextResponse.json([]);

  const { data: pageEndpoints, error: linkError } = await supabaseAdmin
    .from("status_page_endpoints")
    .select("id, status_page_id, endpoint_id, display_name, sort_order, endpoint:endpoints(name, url)")
    .in(
      "status_page_id",
      pages.map((page) => page.id)
    )
    .order("sort_order", { ascending: true });

  if (linkError) {
    console.error("List status pages error: failed to retrieve linked endpoints", linkError);
    if (linkError.code === "PGRST205") return migrationRequired();
    return NextResponse.json(
      { error: "Failed to retrieve status page endpoints" },
      { status: 500 }
    );
  }

  const linksByPage = new Map<string, NonNullable<typeof pageEndpoints>>();
  for (const link of pageEndpoints ?? []) {
    const current = linksByPage.get(link.status_page_id) ?? [];
    current.push(link);
    linksByPage.set(link.status_page_id, current);
  }

  return NextResponse.json(
    pages.map((page) => ({
      ...page,
      status_page_endpoints: linksByPage.get(page.id) ?? [],
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) =>
        !["title", "slug", "description", "endpoint_ids"].includes(key)
    )
  ) {
    return NextResponse.json(
      { error: "Unsupported status page field" },
      { status: 400 }
    );
  }

  const title = input.title;
  const slug = input.slug;
  const description = input.description;
  const endpointIds = input.endpoint_ids;

  if (
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.trim().length > 120
  ) {
    return NextResponse.json(
      { error: "Title must be between 1 and 120 characters" },
      { status: 400 }
    );
  }
  if (
    typeof slug !== "string" ||
    slug.length > 60 ||
    !slugPattern.test(slug)
  ) {
    return NextResponse.json(
      {
        error:
          "Slug must be 1–60 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen",
      },
      { status: 400 }
    );
  }
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== "string" || description.trim().length > 500)
  ) {
    return NextResponse.json(
      { error: "Description must be at most 500 characters" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(endpointIds) ||
    endpointIds.length === 0 ||
    endpointIds.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(endpointIds).size !== endpointIds.length
  ) {
    return NextResponse.json(
      { error: "Select at least one unique endpoint" },
      { status: 400 }
    );
  }

  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from("endpoints")
    .select("id")
    .eq("user_id", user.id)
    .in("id", endpointIds);

  if (endpointsError) {
    console.error("Create status page error: failed to verify endpoints", endpointsError);
    return NextResponse.json(
      { error: "Failed to verify selected endpoints" },
      { status: 500 }
    );
  }
  if (endpoints?.length !== endpointIds.length) {
    return NextResponse.json(
      { error: "One or more selected endpoints were not found" },
      { status: 404 }
    );
  }

  const pageInput: CreateStatusPageBody = {
    title: title.trim(),
    slug,
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
    endpoint_ids: endpointIds,
  };

  const { data: page, error: pageError } = await supabaseAdmin
    .from("status_pages")
    .insert({
      user_id: user.id,
      title: pageInput.title,
      slug: pageInput.slug,
      description: pageInput.description,
      is_public: true,
    })
    .select("id, user_id, slug, title, description, is_public, created_at")
    .single();

  if (pageError) {
    console.error("Create status page error:", pageError);
    if (pageError.code === "PGRST205") return migrationRequired();
    if (pageError.code === "23505") {
      return NextResponse.json(
        { error: "That status page URL is already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create status page" },
      { status: 500 }
    );
  }

  const { error: linksError } = await supabaseAdmin
    .from("status_page_endpoints")
    .insert(
      pageInput.endpoint_ids.map((endpointId, sortOrder) => ({
        status_page_id: page.id,
        endpoint_id: endpointId,
        sort_order: sortOrder,
      }))
    );

  if (linksError) {
    console.error("Create status page error: failed to link endpoints", linksError);
    const { error: cleanupError } = await supabaseAdmin
      .from("status_pages")
      .delete()
      .eq("id", page.id)
      .eq("user_id", user.id);
    if (cleanupError) {
      console.error("Create status page error: failed to clean up partial page", cleanupError);
    }
    if (linksError.code === "PGRST205") return migrationRequired();
    return NextResponse.json(
      { error: "Failed to attach endpoints to status page" },
      { status: 500 }
    );
  }

  return NextResponse.json(page, { status: 201 });
}
