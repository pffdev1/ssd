import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

type RequestNotifyPayload = {
  requestId: string;
  eventType: "created" | "updated" | "approved" | "rejected";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (request) => {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(jwt);

    if (claimsError || !claims?.claims?.email) {
      return json({ error: "Invalid JWT." }, 401);
    }

    const payload = (await request.json()) as RequestNotifyPayload;

    const { data: requestRow, error: requestError } = await supabase
      .from("requests")
      .select(
        `
          id,
          ticket_code,
          subject,
          status,
          requester_name,
          requester_email,
          department,
          request_types(name)
        `
      )
      .eq("id", payload.requestId)
      .single();

    if (requestError || !requestRow) {
      return json({ error: "Request not found." }, 404);
    }

    const { data: pendingStep } = await supabase
      .from("request_steps")
      .select("approver_name, approver_email, label")
      .eq("request_id", payload.requestId)
      .eq("status", "pending")
      .order("sequence", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Aqui SSD puede invocar Resend o Microsoft Graph.
    // Resend es preferible dentro de Edge Functions porque SMTP 25/587 no esta permitido.
    const notificationEnvelope = {
      request: requestRow,
      pendingStep,
      eventType: payload.eventType
    };

    if (!resendApiKey) {
      console.info("request-notify preview", notificationEnvelope);
      return json({
        ok: true,
        mode: "preview",
        message: "RESEND_API_KEY no configurado. Se dejo el payload listo para integrar correo transaccional."
      });
    }

    // Placeholder para integracion con Resend.
    // Sustituir por el render final de React Email y el endpoint de Resend/Graph.
    console.info("request-notify ready-to-send", notificationEnvelope);

    return json({
      ok: true,
      mode: "ready",
      message: "Function preparada para conectar React Email + proveedor transaccional."
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected error."
      },
      500
    );
  }
});
