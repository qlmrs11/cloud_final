const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-User-Role",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function handlePost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!name || !email || !password) {
      return jsonResponse(
        { success: false, message: "Name, email, and password are required" },
        400,
      );
    }

    const existingUser = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    )
      .bind(email)
      .first();

    if (existingUser) {
      return jsonResponse(
        { success: false, message: "Email is already registered" },
        409,
      );
    }

    await env.DB.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
    )
      .bind(name, email, password)
      .run();

    return jsonResponse({
      success: true,
      message: "Registration successful. Please login.",
    });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to register user", error: error.message },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (context.request.method === "POST") {
    return handlePost(context);
  }

  return jsonResponse({ success: false, message: "Method not allowed" }, 405);
}
