// =========================================================
// MENSAJERÍA ANÓNIMA — Cliente de Supabase (configuración central)
// =========================================================
// Reemplaza estos valores por los de tu proyecto Supabase.
// Estas son claves PÚBLICAS (anon key), seguras para el frontend.
// La seguridad real la aplica Row Level Security (RLS) en la base de datos.

const SUPABASE_URL = window.__MENSAJEA_ENV__?.SUPABASE_URL || "https://xphjayalihplwlgvsssz.supabase.co";
const SUPABASE_ANON_KEY = window.__MENSAJEA_ENV__?.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaGpheWFsaWhwbHdsZ3Zzc3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTkxOTUsImV4cCI6MjEwMzE5NTE5NX0.oz3gpJv76Qs5gCKmxH-Wza3K33F0kHMHxH-3dlOLSoU";

// Cliente global compartido por toda la app (usa el SDK cargado vía CDN, ver <script> en cada HTML)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Nombre de la app, centralizado para poder cambiarlo fácilmente.
const APP_NAME = "Mensajería Anónima";

// Construye la URL pública de un usuario, ej: https://midominio.com/u/juan123
function buildPublicLink(username) {
  return `${window.location.origin}/u/${username}`;
}

// Helper genérico para mostrar toasts de éxito/error en español.
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Traduce errores comunes de Supabase Auth a español.
function translateAuthError(error) {
  if (!error) return "Ocurrió un error inesperado.";
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("user already registered")) return "Ya existe una cuenta con este correo.";
  if (msg.includes("password should be at least")) return "La contraseña es demasiado corta (mínimo 6 caracteres).";
  if (msg.includes("email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesión.";
  if (msg.includes("rate limit")) return "Demasiados intentos. Espera unos minutos.";
  if (msg.includes("duplicate key") || msg.includes("username")) return "Ese nombre de usuario ya está en uso.";
  return error.message || "Ocurrió un error inesperado.";
}

// Redirige a login si no hay sesión activa; devuelve la sesión si existe.
async function requireSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login.html";
    return null;
  }
  return session;
}
