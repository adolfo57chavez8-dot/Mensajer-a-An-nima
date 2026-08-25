// =========================================================
// MENSAJERÍA ANÓNIMA — Autenticación (registro, login, recuperación)
// =========================================================

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = [
  "admin", "root", "api", "www", "soporte", "support", "mensajeria_anonima",
  "settings", "login", "register", "dashboard", "messages", "profile",
  "null", "undefined", "auth", "app", "ayuda", "help",
];

function setFieldError(fieldId, message) {
  const el = document.getElementById(`error-${fieldId}`);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.add("visible");
  } else {
    el.textContent = "";
    el.classList.remove("visible");
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username) {
  if (!username) return "El nombre de usuario es obligatorio.";
  if (!USERNAME_REGEX.test(username)) {
    return "Usa entre 3 y 20 caracteres: minúsculas, números y guion bajo, sin espacios.";
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return "Ese nombre de usuario no está disponible.";
  }
  return null;
}

// ---------------------------------------------------------
// REGISTRO
// ---------------------------------------------------------
async function handleRegister(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("register-submit");
  const fullName = document.getElementById("full_name").value.trim();
  const username = document.getElementById("username").value.trim().toLowerCase();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setFieldError("full_name", "");
  setFieldError("username", "");
  setFieldError("email", "");
  setFieldError("password", "");

  let hasError = false;
  if (!fullName) { setFieldError("full_name", "Ingresa tu nombre completo."); hasError = true; }
  const usernameError = validateUsername(username);
  if (usernameError) { setFieldError("username", usernameError); hasError = true; }
  if (!validateEmail(email)) { setFieldError("email", "Ingresa un correo electrónico válido."); hasError = true; }
  if (!password || password.length < 6) { setFieldError("password", "La contraseña debe tener al menos 6 caracteres."); hasError = true; }
  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Creando cuenta...";

  try {
    // Verificar disponibilidad del username antes de intentar el registro
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      setFieldError("username", "Ese nombre de usuario ya está en uso.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Crear cuenta";
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        emailRedirectTo: `${window.location.origin}/login.html`,
      },
    });

    if (error) throw error;

    // Si ya hay sesión (confirmación de correo desactivada), continuar el flujo de "volver al perfil"
    const pendingUsername = sessionStorage.getItem("mensajea_pending_profile");
    const pendingMessage = sessionStorage.getItem("mensajea_pending_message");

    if (data.session) {
      showToast("¡Cuenta creada correctamente!", "success");
      if (pendingUsername) {
        window.location.href = `/u/${pendingUsername}${pendingMessage ? "?restore=1" : ""}`;
      } else {
        window.location.href = "/dashboard.html";
      }
    } else {
      showToast("Revisa tu correo para confirmar tu cuenta.", "success");
      window.location.href = "/login.html";
    }
  } catch (err) {
    showToast(translateAuthError(err), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Crear cuenta";
  }
}

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------
async function handleLogin(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("login-submit");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setFieldError("email", "");
  setFieldError("password", "");

  let hasError = false;
  if (!validateEmail(email)) { setFieldError("email", "Ingresa un correo electrónico válido."); hasError = true; }
  if (!password) { setFieldError("password", "Ingresa tu contraseña."); hasError = true; }
  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Iniciando sesión...";

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const pendingUsername = sessionStorage.getItem("mensajea_pending_profile");
    if (pendingUsername) {
      window.location.href = `/u/${pendingUsername}?restore=1`;
    } else {
      window.location.href = "/dashboard.html";
    }
  } catch (err) {
    showToast(translateAuthError(err), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Iniciar sesión";
  }
}

// ---------------------------------------------------------
// RECUPERAR CONTRASEÑA — solicitar enlace
// ---------------------------------------------------------
async function handleForgotPassword(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("forgot-submit");
  const email = document.getElementById("email").value.trim();

  setFieldError("email", "");
  if (!validateEmail(email)) { setFieldError("email", "Ingresa un correo electrónico válido."); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/forgot-password.html?step=reset`,
    });
    if (error) throw error;
    showToast("Enlace de recuperación enviado. Revisa tu correo.", "success");
    document.getElementById("forgot-form").style.display = "none";
    document.getElementById("forgot-sent").style.display = "block";
  } catch (err) {
    showToast(translateAuthError(err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar enlace de recuperación";
  }
}

// ---------------------------------------------------------
// RECUPERAR CONTRASEÑA — establecer nueva contraseña
// ---------------------------------------------------------
async function handleResetPassword(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("reset-submit");
  const password = document.getElementById("new_password").value;
  const confirm = document.getElementById("confirm_password").value;

  setFieldError("new_password", "");
  setFieldError("confirm_password", "");

  let hasError = false;
  if (!password || password.length < 6) { setFieldError("new_password", "Mínimo 6 caracteres."); hasError = true; }
  if (password !== confirm) { setFieldError("confirm_password", "Las contraseñas no coinciden."); hasError = true; }
  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Actualizando...";

  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    showToast("Contraseña actualizada correctamente.", "success");
    setTimeout(() => { window.location.href = "/login.html"; }, 1200);
  } catch (err) {
    showToast(translateAuthError(err), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Actualizar contraseña";
  }
}

// ---------------------------------------------------------
// LOGOUT (usado en settings.js / dashboard.js)
// ---------------------------------------------------------
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = "/login.html";
}
