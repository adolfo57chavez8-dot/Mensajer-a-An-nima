// =========================================================
// MENSAJERÍA ANÓNIMA — Configuración
// =========================================================

let userId = null;
let currentProfile = null;

(async function initSettings() {
  const session = await requireSession();
  if (!session) return;
  userId = session.user.id;

  const [{ data: profile }, { data: settingsRow }] = await Promise.all([
    supabaseClient.from("profiles").select("*").eq("id", userId).single(),
    supabaseClient.from("user_settings").select("*").eq("user_id", userId).single(),
  ]);

  currentProfile = profile;

  document.getElementById("edit-full-name").value = profile?.full_name || "";
  document.getElementById("edit-username").value = profile?.username || "";
  document.getElementById("account-email").value = session.user.email || "";
  document.getElementById("toggle-link-paused").checked = !!profile?.link_paused;

  if (settingsRow) {
    document.getElementById("toggle-email-notif").checked = settingsRow.email_notifications;
    document.getElementById("toggle-filtering").checked = settingsRow.message_filtering;
    document.getElementById("appearance-select").value = settingsRow.appearance;
  }

  await refreshHiddenWordsCount();
  await refreshBlockedUsersCount();

  document.getElementById("loading").style.display = "none";
  document.getElementById("content").style.display = "block";
  renderBottomNav("settings");

  bindEvents();
})();

function bindEvents() {
  document.getElementById("toggle-email-notif").addEventListener("change", async (e) => {
    await upsertSettings({ email_notifications: e.target.checked });
    showToast(e.target.checked ? "Notificaciones por correo activadas" : "Notificaciones por correo desactivadas", "success");
  });

  document.getElementById("toggle-filtering").addEventListener("change", async (e) => {
    await upsertSettings({ message_filtering: e.target.checked });
  });

  document.getElementById("appearance-select").addEventListener("change", async (e) => {
    await upsertSettings({ appearance: e.target.value });
    localStorage.setItem("mensajea_appearance_cache", e.target.value);
    applyStoredAppearance();
    showToast("Apariencia actualizada", "success");
  });

  document.getElementById("toggle-link-paused").addEventListener("change", async (e) => {
    const { error } = await supabaseClient.from("profiles").update({ link_paused: e.target.checked }).eq("id", userId);
    if (error) { showToast("No se pudo actualizar.", "error"); return; }
    showToast(e.target.checked ? "Tu enlace está pausado" : "Tu enlace está activo de nuevo", "success");
  });

  document.getElementById("save-account-btn").addEventListener("click", saveAccountChanges);
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("delete-account-btn").addEventListener("click", confirmDeleteAccount);

  // Palabras ocultas
  document.getElementById("open-hidden-words").addEventListener("click", () => {
    document.getElementById("hidden-words-modal").classList.add("open");
    loadHiddenWords();
  });
  document.getElementById("close-hidden-words-modal").addEventListener("click", () => {
    document.getElementById("hidden-words-modal").classList.remove("open");
  });
  document.getElementById("add-hidden-word-btn").addEventListener("click", addHiddenWord);

  // Usuarios bloqueados
  document.getElementById("open-blocked-users").addEventListener("click", () => {
    document.getElementById("blocked-users-modal").classList.add("open");
    loadBlockedUsers();
  });
  document.getElementById("close-blocked-modal").addEventListener("click", () => {
    document.getElementById("blocked-users-modal").classList.remove("open");
  });

  // Cambiar contraseña
  document.getElementById("open-change-password").addEventListener("click", () => {
    document.getElementById("change-password-modal").classList.add("open");
  });
  document.getElementById("close-change-password-modal").addEventListener("click", () => {
    document.getElementById("change-password-modal").classList.remove("open");
  });
  document.getElementById("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("cp-new").value;
    const confirm = document.getElementById("cp-confirm").value;
    setFieldError("cp-new", "");
    setFieldError("cp-confirm", "");
    if (!pass || pass.length < 6) { setFieldError("cp-new", "Mínimo 6 caracteres."); return; }
    if (pass !== confirm) { setFieldError("cp-confirm", "Las contraseñas no coinciden."); return; }

    const { error } = await supabaseClient.auth.updateUser({ password: pass });
    if (error) { showToast(translateAuthError(error), "error"); return; }
    showToast("Contraseña actualizada", "success");
    document.getElementById("change-password-modal").classList.remove("open");
    document.getElementById("change-password-form").reset();
  });
}

async function upsertSettings(patch) {
  await supabaseClient.from("user_settings").update(patch).eq("user_id", userId);
}

async function saveAccountChanges() {
  const fullName = document.getElementById("edit-full-name").value.trim();
  const username = document.getElementById("edit-username").value.trim().toLowerCase();
  setFieldError("edit-username", "");

  const usernameError = validateUsername(username);
  if (usernameError) { setFieldError("edit-username", usernameError); return; }

  if (username !== currentProfile.username) {
    const { data: existing } = await supabaseClient
      .from("profiles").select("id").eq("username", username).maybeSingle();
    if (existing) { setFieldError("edit-username", "Ese nombre de usuario ya está en uso."); return; }
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({ full_name: fullName, username })
    .eq("id", userId);

  if (error) { showToast("No se pudieron guardar los cambios.", "error"); return; }
  currentProfile.full_name = fullName;
  currentProfile.username = username;
  showToast("Cambios guardados", "success");
}

async function confirmDeleteAccount() {
  const ok = window.confirm("¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.");
  if (!ok) return;
  // Desactivación desde el cliente (la eliminación real de auth.users requiere
  // una Edge Function con la service role key — ver README, sección 61).
  const { error } = await supabaseClient
    .from("profiles")
    .update({ is_active: false, link_paused: true })
    .eq("id", userId);

  if (error) { showToast("No se pudo procesar la solicitud.", "error"); return; }
  await supabaseClient.auth.signOut();
  window.location.href = "/";
}

async function refreshHiddenWordsCount() {
  const { count } = await supabaseClient
    .from("hidden_words").select("id", { count: "exact", head: true }).eq("user_id", userId);
  document.getElementById("hidden-words-count").textContent = count || 0;
}

async function refreshBlockedUsersCount() {
  const { count } = await supabaseClient
    .from("blocked_users").select("id", { count: "exact", head: true }).eq("blocker_id", userId);
  document.getElementById("blocked-users-count").textContent = count || 0;
}

async function loadHiddenWords() {
  const container = document.getElementById("hidden-words-chips");
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const { data } = await supabaseClient.from("hidden_words").select("*").eq("user_id", userId).order("created_at", { ascending: false });

  if (!data || data.length === 0) {
    container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">No has agregado palabras todavía.</p>`;
    return;
  }
  container.innerHTML = data.map(w => `
    <span class="hidden-word-chip" data-id="${w.id}">${escapeHtml(w.word)} <button data-remove="${w.id}">×</button></span>
  `).join("");

  container.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("hidden_words").delete().eq("id", btn.dataset.remove);
      await loadHiddenWords();
      await refreshHiddenWordsCount();
    });
  });
}

async function addHiddenWord() {
  const input = document.getElementById("new-hidden-word");
  const word = input.value.trim().toLowerCase();
  if (!word) return;

  const { error } = await supabaseClient.from("hidden_words").insert({ user_id: userId, word });
  if (error) {
    showToast(error.code === "23505" ? "Ya agregaste esa palabra." : "No se pudo agregar la palabra.", "error");
    return;
  }
  input.value = "";
  await loadHiddenWords();
  await refreshHiddenWordsCount();
}

async function loadBlockedUsers() {
  const container = document.getElementById("blocked-users-list");
  container.innerHTML = `<div class="loading-spinner"></div>`;

  const { data } = await supabaseClient
    .from("blocked_users")
    .select("id, blocked_id, profiles!blocked_users_blocked_id_fkey(username, full_name, avatar_url)")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) {
    container.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">No has bloqueado a nadie.</p>`;
    return;
  }

  container.innerHTML = data.map(b => `
    <div class="settings-row">
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="avatar" style="width:34px;height:34px;font-size:12px;">${b.profiles?.avatar_url ? `<img src="${b.profiles.avatar_url}" alt=""/>` : initials(b.profiles?.full_name || b.profiles?.username)}</div>
        <span>@${escapeHtml(b.profiles?.username || "usuario")}</span>
      </div>
      <button class="btn btn-ghost btn-sm" data-unblock="${b.id}">Desbloquear</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-unblock]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("blocked_users").delete().eq("id", btn.dataset.unblock);
      await loadBlockedUsers();
      await refreshBlockedUsersCount();
      showToast("Usuario desbloqueado", "success");
    });
  });
}
