// =========================================================
// MENSAJERÍA ANÓNIMA — Layout compartido (nav inferior, guardas de sesión)
// =========================================================

function renderBottomNav(activePage) {
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.innerHTML = `
    <a href="/dashboard.html" class="nav-item ${activePage === "dashboard" ? "active" : ""}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>
      Inicio
    </a>
    <a href="/messages.html" class="nav-item ${activePage === "messages" ? "active" : ""}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Mensajes
      <span class="nav-badge" id="nav-unread-badge" style="display:none">0</span>
    </a>
    <a href="/dashboard.html#link" class="nav-item ${activePage === "link" ? "active" : ""}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.5-1.5"/></svg>
      Mi enlace
    </a>
    <a href="/settings.html" class="nav-item ${activePage === "settings" ? "active" : ""}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Ajustes
    </a>
  `;
  document.body.appendChild(nav);
  refreshUnreadBadge();
}

async function refreshUnreadBadge() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const { count } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", session.user.id)
    .eq("is_read", false)
    .eq("deleted_by_receiver", false);

  const badge = document.getElementById("nav-unread-badge");
  if (badge && count) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = "flex";
  }
}

function applyStoredAppearance() {
  const saved = localStorage.getItem("mensajea_appearance_cache") || "dark";
  if (saved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else if (saved === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

applyStoredAppearance();

function timeAgo(dateString) {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60) return "Justo ahora";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} d`;
  return new Date(dateString).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}
