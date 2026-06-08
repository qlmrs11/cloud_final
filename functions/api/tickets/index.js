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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getAuth(request) {
  const userId = Number(request.headers.get("X-User-Id"));
  const role = request.headers.get("X-User-Role");

  if (!Number.isInteger(userId) || userId <= 0 || !["user", "admin"].includes(role)) {
    return null;
  }

  return { userId, role };
}

function getTicketId(request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePriority(value) {
  return allowedPriorities.includes(value) ? value : "medium";
}

async function getTicket(env, ticketId) {
  return env.DB.prepare(
    `SELECT
       tickets.*,
       users.name AS user_name,
       users.email AS user_email
     FROM tickets
     JOIN users ON users.id = tickets.user_id
     WHERE tickets.id = ?`,
  )
    .bind(ticketId)
    .first();
}

function canAccessTicket(auth, ticket) {
  return auth.role === "admin" || Number(ticket.user_id) === auth.userId;
}

async function getComments(env, ticketId) {
  const result = await env.DB.prepare(
    `SELECT
       ticket_comments.*,
       users.name AS user_name,
       users.email AS user_email,
       users.role AS user_role
     FROM ticket_comments
     JOIN users ON users.id = ticket_comments.user_id
     WHERE ticket_comments.ticket_id = ?
     ORDER BY ticket_comments.created_at ASC, ticket_comments.id ASC`,
  )
    .bind(ticketId)
    .all();

  return result.results || [];
}

async function handleGet(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);
    const ticketId = getTicketId(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    if (ticketId) {
      const ticket = await getTicket(env, ticketId);

      if (!ticket) {
        return jsonResponse({ success: false, message: "Ticket not found" }, 404);
      }

      if (!canAccessTicket(auth, ticket)) {
        return jsonResponse({ success: false, message: "Access denied" }, 403);
      }

      const comments = await getComments(env, ticketId);
      return jsonResponse({ success: true, ticket, comments });
    }

    let result;

    if (auth.role === "admin") {
      result = await env.DB.prepare(
        `SELECT
           tickets.*,
           users.name AS user_name,
           users.email AS user_email
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         ORDER BY tickets.created_at DESC, tickets.id DESC`,
      ).all();
    } else {
      result = await env.DB.prepare(
        `SELECT
           tickets.*,
           users.name AS user_name,
           users.email AS user_email
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

async function addComment(context, ticketId, body, auth) {
  const { env } = context;
  const message = normalizeText(body.message);

  if (!message) {
    return jsonResponse({ success: false, message: "Comment message is required" }, 400);
  }

  const ticket = await getTicket(env, ticketId);

  if (!ticket) {
    return jsonResponse({ success: false, message: "Ticket not found" }, 404);
  }

  if (!canAccessTicket(auth, ticket)) {
    return jsonResponse({ success: false, message: "Access denied" }, 403);
  }

  await env.DB.prepare(
    "INSERT INTO ticket_comments (ticket_id, user_id, message) VALUES (?, ?, ?)",
  )
    .bind(ticketId, auth.userId, message)
    .run();

  const comments = await getComments(env, ticketId);
  return jsonResponse({
    success: true,
    message: "Comment added successfully",
    comments,
  });
}

async function createTicket(context, body, auth) {
  const { env } = context;
  const title = normalizeText(body.title);
  const category = normalizeText(body.category);
  const description = normalizeText(body.description);
  const priority = normalizePriority(body.priority);

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
}

async function handlePost(context) {
  try {
    const { request } = context;
    const auth = getAuth(request);
    const ticketId = getTicketId(request);
    const body = await readJson(request);

    if (!auth) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    if (!body) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

    if (ticketId) {
      return addComment(context, ticketId, body, auth);
    }

    return createTicket(context, body, auth);
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Failed to save ticket data", error: error.message },
      500,
    );
  }
}

async function handlePut(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(request);
    const ticketId = getTicketId(request);
    const body = await readJson(request);

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

    if (!body) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

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

    if ((result.meta?.changes || 0) === 0) {
      return jsonResponse({ success: false, message: "Ticket not found" }, 404);
    }

    await env.DB.prepare(
      "INSERT INTO ticket_comments (ticket_id, user_id, message) VALUES (?, ?, ?)",
    )
      .bind(ticketId, auth.userId, `Status updated to ${status}, priority ${priority}`)
      .run();

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

    const ticket = await getTicket(env, ticketId);

    if (!ticket) {
      return jsonResponse({ success: false, message: "Ticket not found" }, 404);
    }

    if (!canAccessTicket(auth, ticket)) {
      return jsonResponse({ success: false, message: "Access denied" }, 403);
    }

    await env.DB.prepare("DELETE FROM ticket_comments WHERE ticket_id = ?")
      .bind(ticketId)
      .run();

    await env.DB.prepare("DELETE FROM tickets WHERE id = ?").bind(ticketId).run();

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
