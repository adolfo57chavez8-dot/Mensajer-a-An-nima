// =========================================================
// MENSAJERÍA ANÓNIMA — Edge Function: send-message-notification
// =========================================================
// Se dispara mediante un Database Webhook de Supabase configurado en:
//   Supabase Dashboard → Database → Webhooks
//   Tabla: messages | Evento: INSERT | Tipo: Edge Function
//
// Nunca incluye el contenido del mensaje en el correo.
// Nunca cancela el mensaje si el envío de correo falla: solo registra el error.
//
// Variables de entorno requeridas (configurar como secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (solo aquí, nunca en el frontend)
//   RESEND_API_KEY
//   APP_URL                     (ej: https://mensajeriaanonima.app)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://mensajeriaanonima.app";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.record; // fila insertada en "messages"

    if (!message?.id || !message?.receiver_id) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), { status: 400 });
    }

    // 1. Evitar notificaciones duplicadas para el mismo mensaje.
    const { data: existingNotif } = await supabaseAdmin
      .from("email_notifications")
      .select("id")
      .eq("message_id", message.id)
      .eq("type", "new_message")
      .maybeSingle();

    if (existingNotif) {
      return new Response(JSON.stringify({ skipped: true, reason: "ya notificado" }), { status: 200 });
    }

    // 2. Registrar intento como "pending" para respetar la restricción UNIQUE.
    const { data: notifRow, error: insertError } = await supabaseAdmin
      .from("email_notifications")
      .insert({ message_id: message.id, user_id: message.receiver_id, type: "new_message", status: "pending" })
      .select()
      .single();

    if (insertError) {
      // Probablemente ya existe por una condición de carrera: salir en silencio.
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // 3. Comprobar que las notificaciones por correo estén activadas.
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("email_notifications")
      .eq("user_id", message.receiver_id)
      .maybeSingle();

    if (settings && settings.email_notifications === false) {
      await supabaseAdmin.from("email_notifications").update({ status: "skipped" }).eq("id", notifRow.id);
      return new Response(JSON.stringify({ skipped: true, reason: "notificaciones desactivadas" }), { status: 200 });
    }

    // 4. Obtener el correo del receptor.
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(message.receiver_id);
    if (userError || !userData?.user?.email) {
      await supabaseAdmin
        .from("email_notifications")
        .update({ status: "error", error_message: "No se encontró el correo del receptor" })
        .eq("id", notifRow.id);
      return new Response(JSON.stringify({ error: "Receptor sin correo" }), { status: 200 });
    }

    // 5. Enviar el correo mediante Resend (sin incluir el contenido del mensaje).
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mensajería Anónima <notificaciones@mensajeriaanonima.app>",
        to: userData.user.email,
        subject: "💌 Tienes un nuevo mensaje en Mensajería Anónima",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color:#10142a;">Tienes un nuevo mensaje</h2>
            <p style="color:#4b5563;">Hola, tienes un nuevo mensaje en tu cuenta de Mensajería Anónima. Entra a la aplicación para revisarlo.</p>
            <a href="${APP_URL}/messages.html" style="display:inline-block; margin-top:16px; background:#5b7cfa; color:white; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:600;">Revisar mensaje</a>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      await supabaseAdmin
        .from("email_notifications")
        .update({ status: "error", error_message: errText.slice(0, 500) })
        .eq("id", notifRow.id);
      // No se cancela el mensaje: ya está guardado y visible para el receptor.
      return new Response(JSON.stringify({ error: "Fallo al enviar correo" }), { status: 200 });
    }

    await supabaseAdmin
      .from("email_notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", notifRow.id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
