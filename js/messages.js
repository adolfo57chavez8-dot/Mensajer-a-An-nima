// =========================================================
// MENSAJERÍA ANÓNIMA — Bandeja de mensajes
// =========================================================

let currentUserId = null;
let currentMessages = [];
let activeMessageId = null;

(async function initMessages() {
  const session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;

  await loadMessages();

  document.getElementById("loading").style.display = "none";
  document.getElementById("content").style.display = "block";
  renderBottomNav("messages");

  document.getElementById("modal-close-btn").addEventListener("click", closeMessageModal);
  document.getElementById("modal-delete-btn").addEventListener("click", deleteActiveMessage);
  document.getElementById("modal-block-btn").addEventListener("click", blockActiveSender);
  document.getElementById("modal-report-btn").addEventListener("click", openReportModal);
  document.getElementById("report-cancel-btn").addEventListener("click", closeReportModal);
  document.getElementById("report-submit-btn").addEventListener("click", submitReport);

  // Deep link ?id=
  const params = new URLSearchParams(window.location.search);
  const deepLinkId = params.get("id");
  if (deepLinkId) openMessageModal(deepLinkId);
})();

async function loadMessages() {
  const list = document.getElementById("messages-list");
  list.innerHTML = `<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, content, created_at, is_read, sender_id, profiles!messages_sender_id_fkey(username, full_name, avatar_url)")
    .eq("receiver_id", currentUserId)
    .eq("deleted_by_receiver", false)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="empty-state"><h3>Error al cargar mensajes</h3><p>Intenta recargar la página.</p></div>`;
    return;
  }

  currentMessages = data || [];

  if (currentMessages.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>No tienes mensajes todavía</h3>
        <p>Comparte tu enlace personal para recibir tu primer mensaje.</p>
      </div>`;
    return;
  }

  list.innerHTML = currentMessages.map(m => `
    <div class="message-item ${!m.is_read ? "unread" : ""}" data-id="${m.id}">
      <div class="avatar">${m.profiles?.avatar_url ? `<img src="${m.profiles.avatar_url}" alt="" />` : initials(m.profiles?.full_name || m.profiles?.username)}</div>
      <div class="message-item-body">
        <div class="message-item-top">
          <span class="message-item-username">@${escapeHtml(m.profiles?.username || "usuario")}</span>
          <span class="message-item-time">${timeAgo(m.created_at)}</span>
        </div>
        <div class="message-item-preview">${escapeHtml(m.content)}</div>
      </div>
      ${!m.is_read ? '<div class="unread-dot"></div>' : ""}
    </div>
  `).join("");

  list.querySelectorAll(".message-item").forEach(el => {
    el.addEventListener("click", () => openMessageModal(el.dataset.id));
  });
}

async function openMessageModal(id) {
  const message = currentMessages.find(m => m.id === id);
  if (!message) return;
  activeMessageId = id;

  document.getElementById("modal-avatar").innerHTML = message.profiles?.avatar_url
    ? `<img src="${message.profiles.avatar_url}" alt="" />`
    : initials(message.profiles?.full_name || message.profiles?.username);
  document.getElementById("modal-username").textContent = `@${message.profiles?.username || "usuario"}`;
  document.getElementById("modal-time").textContent = timeAgo(message.created_at);
  document.getElementById("modal-content").textContent = message.content;

  document.getElementById("message-modal").classList.add("open");

  if (!message.is_read) {
    await supabaseClient
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    message.is_read = true;
    refreshUnreadBadge();
    const row = document.querySelector(`.message-item[data-id="${id}"]`);
    if (row) {
      row.classList.remove("unread");
      row.querySelector(".unread-dot")?.remove();
    }
  }
}

function closeMessageModal() {
  document.getElementById("message-modal").classList.remove("open");
  activeMessageId = null;
}

async function deleteActiveMessage() {
  if (!activeMessageId) return;
  const { error } = await supabaseClient
    .from("messages")
    .update({ deleted_by_receiver: true })
    .eq("id", activeMessageId);

  if (error) {
    showToast("No se pudo eliminar el mensaje.", "error");
    return;
  }
  showToast("Mensaje eliminado", "success");
  closeMessageModal();
  await loadMessages();
}

async function blockActiveSender() {
  const message = currentMessages.find(m => m.id === activeMessageId);
  if (!message) return;

  const { error } = await supabaseClient
    .from("blocked_users")
    .insert({ blocker_id: currentUserId, blocked_id: message.sender_id });

  if (error) {
    showToast("No se pudo bloquear al usuario.", "error");
    return;
  }
  showToast(`Bloqueaste a @${message.profiles?.username}`, "success");
  closeMessageModal();
}

function openReportModal() {
  document.getElementById("report-modal").classList.add("open");
}
function closeReportModal() {
  document.getElementById("report-modal").classList.remove("open");
}

async function submitReport() {
  if (!activeMessageId) return;
  const reason = document.getElementById("report-reason").value;

  const { error } = await supabaseClient
    .from("reports")
    .insert({ message_id: activeMessageId, reporter_id: currentUserId, reason });

  if (error) {
    showToast("No se pudo enviar el reporte.", "error");
    return;
  }
  showToast("Reporte enviado. Gracias por avisarnos.", "success");
  closeReportModal();
  closeMessageModal();
}
