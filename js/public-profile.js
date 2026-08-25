// =========================================================
// MENSAJERÍA ANÓNIMA — Perfil público (/u/:username)
// =========================================================

function getUsernameFromPath() {
  // Soporta /u/username (ruta limpia vía vercel.json) y ?u=username como respaldo.
  const match = window.location.pathname.match(/\/u\/([^/]+)/);
  if (match) return decodeURIComponent(match[1]).toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (params.get("u") || "").toLowerCase();
}

let targetProfile = null;

(async function initPublicProfile() {
  const username = getUsernameFromPath();
  if (!username) {
    showState("notfound-state");
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("username", username)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    showState("notfound-state");
    return;
  }

  targetProfile = profile;
  document.title = `@${profile.username} — Mensajería Anónima`;

  if (profile.link_paused) {
    showState("paused-state");
    return;
  }

  document.getElementById("profile-username").textContent = `@${profile.username}`;
  const avatarEl = document.getElementById("profile-avatar");
  avatarEl.innerHTML = profile.avatar_url
    ? `<img src="${profile.avatar_url}" alt="" />`
    : initials(profile.full_name || profile.username);

  showState("profile-state");
  bindComposer();

  // Restaurar mensaje pendiente tras registro/login
  const params = new URLSearchParams(window.location.search);
  if (params.get("restore") === "1") {
    const pendingText = sessionStorage.getItem("mensajea_pending_message");
    if (pendingText) {
      document.getElementById("message-content").value = pendingText;
      updateCharCount();
    }
  }
})();

function showState(id) {
  ["notfound-state", "paused-state", "profile-state"].forEach(s => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
  document.getElementById("loading").style.display = "none";
}

function bindComposer() {
  const textarea = document.getElementById("message-content");
  textarea.addEventListener("input", updateCharCount);
  document.getElementById("send-message-btn").addEventListener("click", handleSendMessage);
  document.getElementById("auth-modal-cancel").addEventListener("click", () => {
    document.getElementById("auth-required-modal").classList.remove("open");
  });
}

function updateCharCount() {
  const textarea = document.getElementById("message-content");
  document.getElementById("char-count").textContent = textarea.value.length;
}

async function handleSendMessage() {
  const textarea = document.getElementById("message-content");
  const content = textarea.value.trim();
  setFieldErrorLocal("");

  if (!content) { setFieldErrorLocal("Escribe un mensaje antes de enviarlo."); return; }
  if (content.length > 500) { setFieldErrorLocal("El mensaje no puede superar los 500 caracteres."); return; }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    // Guardar el username y el borrador para retomar el flujo tras registrarse/iniciar sesión.
    sessionStorage.setItem("mensajea_pending_profile", targetProfile.username);
    sessionStorage.setItem("mensajea_pending_message", content);
    document.getElementById("modal-register-link").href = "/register.html";
    document.getElementById("modal-login-link").href = "/login.html";
    document.getElementById("auth-required-modal").classList.add("open");
    return;
  }

  if (session.user.id === targetProfile.id) {
    setFieldErrorLocal("No puedes enviarte un mensaje a ti mismo.");
    return;
  }

  const sendBtn = document.getElementById("send-message-btn");
  sendBtn.disabled = true;
  sendBtn.textContent = "Enviando...";

  const { error } = await supabaseClient.from("messages").insert({
    sender_id: session.user.id,
    receiver_id: targetProfile.id,
    content,
  });

  sendBtn.disabled = false;
  sendBtn.textContent = "Enviar mensaje";

  if (error) {
    if (error.message?.toLowerCase().includes("no autorizado")) {
      setFieldErrorLocal("No se pudo verificar tu sesión. Vuelve a iniciar sesión.");
    } else if (error.message?.toLowerCase().includes("rápido")) {
      setFieldErrorLocal("Estás enviando mensajes demasiado rápido. Espera un momento.");
    } else {
      setFieldErrorLocal("No se pudo enviar el mensaje. Es posible que te hayan bloqueado o que el enlace esté pausado.");
    }
    return;
  }

  sessionStorage.removeItem("mensajea_pending_profile");
  sessionStorage.removeItem("mensajea_pending_message");
  textarea.value = "";
  updateCharCount();

  document.getElementById("sent-modal").classList.add("open");
  setTimeout(() => { window.location.href = "/dashboard.html"; }, 2200);
}

function setFieldErrorLocal(message) {
  const el = document.getElementById("error-message");
  if (message) {
    el.textContent = message;
    el.classList.add("visible");
  } else {
    el.textContent = "";
    el.classList.remove("visible");
  }
}
