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
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return jsonResponse(
        { success: false, message: "Email and password are required" },
        400,
      );
    }

    const user = await env.DB.prepare(
      "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?",
    )
      .bind(email, password)
      .first();

    if (!user) {
      return jsonResponse(
        { success: false, message: "Invalid email or password" },
        401,
      );
    }

    return jsonResponse({
      success: true,
      message: "Login successful",
      user,
      token: `${user.id}-${user.role}`,
    });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to login", error: error.message },
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
