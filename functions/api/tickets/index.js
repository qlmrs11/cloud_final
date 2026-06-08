const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-User-Role",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["open", "process", "done"];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getAuth(request) {
  const userId = Number(request.headers.get("X-User-Id"));
  const role = request.headers.get("X-User-Role");

  if (!userId || !["user", "admin"].includes(role)) {
    return null;
  }

  return { userId, role };
}

function getTicketId(request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function handleGet(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    let result;

    if (auth.role === "admin") {
      result = await env.DB.prepare(
        `SELECT tickets.*, users.name AS user_name, users.email AS user_email
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         ORDER BY tickets.created_at DESC, tickets.id DESC`,
      ).all();
    } else {
      result = await env.DB.prepare(
        `SELECT tickets.*, users.name AS user_name, users.email AS user_email
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         WHERE tickets.user_id = ?
         ORDER BY tickets.created_at DESC, tickets.id DESC`,
      )
        .bind(auth.userId)
        .all();
    }

    return jsonResponse({ success: true, tickets: result.results || [] });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to fetch tickets", error: error.message },
      500,
    );
  }
}

async function handlePost(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const title = body.title?.trim();
    const category = body.category?.trim();
    const description = body.description?.trim();
    const priority = allowedPriorities.includes(body.priority)
      ? body.priority
      : "medium";

    if (!title || !category || !description) {
      return jsonResponse(
        { success: false, message: "Title, category, and description are required" },
        400,
      );
    }

    await env.DB.prepare(
      `INSERT INTO tickets (user_id, title, category, description, priority, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
    )
      .bind(auth.userId, title, category, description, priority)
      .run();

    return jsonResponse({ success: true, message: "Ticket created successfully" });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to create ticket", error: error.message },
      500,
    );
  }
}

async function handlePut(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);
    const ticketId = getTicketId(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    if (auth.role !== "admin") {
      return jsonResponse(
        { success: false, message: "Only admin can update tickets" },
        403,
      );
    }

    if (!ticketId) {
      return jsonResponse({ success: false, message: "Ticket id is required" }, 400);
    }

    const body = await request.json();
    const status = body.status;
    const priority = body.priority;

    if (!allowedStatuses.includes(status) || !allowedPriorities.includes(priority)) {
      return jsonResponse(
        {
          success: false,
          message: "Status must be open, process, or done. Priority must be low, medium, or high.",
        },
        400,
      );
    }

    const result = await env.DB.prepare(
      "UPDATE tickets SET status = ?, priority = ? WHERE id = ?",
    )
      .bind(status, priority, ticketId)
      .run();

    if (result.meta.changes === 0) {
      return jsonResponse({ success: false, message: "Ticket not found" }, 404);
    }

    return jsonResponse({ success: true, message: "Ticket updated successfully" });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to update ticket", error: error.message },
      500,
    );
  }
}

async function handleDelete(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);
    const ticketId = getTicketId(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    if (!ticketId) {
      return jsonResponse({ success: false, message: "Ticket id is required" }, 400);
    }

    let result;

    if (auth.role === "admin") {
      result = await env.DB.prepare("DELETE FROM tickets WHERE id = ?")
        .bind(ticketId)
        .run();
    } else {
      result = await env.DB.prepare(
        "DELETE FROM tickets WHERE id = ? AND user_id = ?",
      )
        .bind(ticketId, auth.userId)
        .run();
    }

    if (result.meta.changes === 0) {
      return jsonResponse(
        { success: false, message: "Ticket not found or access denied" },
        404,
      );
    }

    return jsonResponse({ success: true, message: "Ticket deleted successfully" });
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to delete ticket", error: error.message },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (context.request.method === "GET") {
    return handleGet(context);
  }

  if (context.request.method === "POST") {
    return handlePost(context);
  }

  if (context.request.method === "PUT") {
    return handlePut(context);
  }

  if (context.request.method === "DELETE") {
    return handleDelete(context);
  }

  return jsonResponse({ success: false, message: "Method not allowed" }, 405);
}
