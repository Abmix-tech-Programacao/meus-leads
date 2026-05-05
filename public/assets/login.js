const form      = document.getElementById("loginForm");
const errorText = document.getElementById("loginError");
const submitBtn = document.getElementById("loginSubmit");
const btnText   = document.getElementById("loginBtnText");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorText.textContent = "";

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  /* Loading state */
  submitBtn.disabled = true;
  btnText.textContent = "Entrando…";

  try {
    const response = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });

    const payload = await response.json();
    if (!response.ok) {
      errorText.textContent  = payload.error || "E-mail ou senha inválidos.";
      submitBtn.disabled     = false;
      btnText.textContent    = "Entrar no painel";
      return;
    }

    btnText.textContent = "Redirecionando…";
    window.location.href = "/dashboard.html";
  } catch {
    errorText.textContent = "Erro de conexão. Tente novamente.";
    submitBtn.disabled    = false;
    btnText.textContent   = "Entrar no painel";
  }
});
