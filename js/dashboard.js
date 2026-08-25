// =========================================================
// MENSAJERÍA ANÓNIMA — Dashboard
// =========================================================

(async function initDashboard() {
  const session = await requireSession();
  if (!session) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    showToast("No se pudo cargar tu perfil.", "error");
    return;
  }

  document.getElementById("greeting-name").textContent = `Hola, ${profile.full_name.split(" ")[0]}`;
  document.getElementById("greeting-username").textContent = `@${profile.username}`;

  const topbarAvatar = document.getElementById("topbar-avatar");
  if (profile.avatar_url) {
    topbarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="" />`;
  } else {
    topbarAvatar.textContent = initials(profile.full_name);
  }

  const link = buildPublicLink(profile.username);
  document.getElementById("personal-link").textContent = link.replace(/^https?:\/\//, "");

  document.getElementById("copy-link-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Enlace copiado", "success");
    } catch {
      showToast("No se pudo copiar el enlace.", "error");
    }
  });

  document.getElementById("share-link-btn").addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mensajería Anónima", text: `Envíame un mensaje en Mensajería Anónima:`, url: link });
      } catch {
        /* usuario canceló, no hacer nada */
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        showToast("Enlace copiado", "success");
      } catch {
        showToast("No se pudo copiar el enlace.", "error");
      }
    }
  });

  // Estadísticas
  const { count: total } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", session.user.id)
    .eq("deleted_by_receiver", false);

  const { count: unread } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", session.user.id)
    .eq("is_read", false)
    .eq("deleted_by_receiver", false);

  document.getElementById("stat-total").textContent = total || 0;
  document.getElementById("stat-unread").textContent = unread || 0;

  // Actividad reciente (últimos 5 mensajes)
  const { data: recent } = await supabaseClient
    .from("messages")
    .select("id, content, created_at, is_read, sender_id, profiles!messages_sender_id_fkey(username, full_name, avatar_url)")
    .eq("receiver_id", session.user.id)
    .eq("deleted_by_receiver", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const activityList = document.getElementById("activity-list");
  if (!recent || recent.length === 0) {
    activityList.innerHTML = `
      <div class="empty-state">
        <h3>Aún no tienes mensajes</h3>
        <p>Comparte tu enlace para empezar a recibir mensajes.</p>
      </div>`;
  } else {
    activityList.innerHTML = recent.map(m => `
      <div class="message-item ${!m.is_read ? "unread" : ""}" onclick="window.location.href='/messages.html?id=${m.id}'">
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
  }

  document.getElementById("loading").style.display = "none";
  document.getElementById("content").style.display = "block";
  renderBottomNav("dashboard");
})();
