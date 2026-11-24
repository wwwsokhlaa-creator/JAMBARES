
(() => {
  const client = window.supabaseClient;
  const modules = document.getElementById("modules");

  if (!client || !modules) {
    console.error("Supabase ou espace pédagogique introuvable.");
    return;
  }

  const area = document.createElement("section");
  area.id = "authArea";
  area.className = "welcome";
  modules.before(area);

  area.innerHTML = `
    <h2>Accès sécurisé à JAMBARE</h2>
    <p id="authMessage">
      Connecte-toi ou crée ton compte militaire.
      Toute inscription doit être autorisée.
    </p>

    <form id="loginForm">
      <input id="email" type="email"
        placeholder="Adresse e-mail" required>
      <input id="password" type="password"
        placeholder="Mot de passe" required>
      <button type="submit">Se connecter</button>
    </form>

    <hr>

    <h3>Créer un compte</h3>
    <form id="signupForm">
      <input id="fullName" type="text"
        placeholder="Nom et prénom" required>
      <input id="nomGuerre" type="text"
        placeholder="Nom de guerre">
      <input id="newEmail" type="email"
        placeholder="Adresse e-mail" required>
      <input id="newPassword" type="password"
        placeholder="Mot de passe (8 caractères minimum)"
        minlength="8" required>
      <button type="submit">Demander un accès</button>
    </form>
  `;

  const message = document.getElementById("authMessage");
  let activeUserId = null;
  let adminInitializedFor = null;
  let accessCheck = Promise.resolve();

  function showMessage(text) {
    message.textContent = text;
  }

  function showLogin(text) {
    modules.hidden = true;
    area.hidden = false;
    showMessage(text);
  }

  async function checkAccess(session) {
    if (!session) {
      activeUserId = null;
      adminInitializedFor = null;
      showLogin("Connecte-toi ou crée ton compte militaire.");
      return;
    }

    const user = session.user;

    const { data, error } = await client
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      await client.auth.signOut();
      activeUserId = null;
      adminInitializedFor = null;
      showLogin("Profil introuvable. Contacte le propriétaire.");
      return;
    }

    const allowed = ["owner", "admin", "trainer", "military"];

    if (!allowed.includes(data.role)) {
      activeUserId = null;
      adminInitializedFor = null;
      await client.auth.signOut();
      showLogin("Compte en attente d'autorisation. Réessaie après validation.");
      return;
    }

    activeUserId = user.id;

    area.innerHTML = `
      <h2>Bienvenue sur JAMBARE</h2>
      <p>Accès autorisé : ${data.role}</p>
      <button id="logoutButton">Se déconnecter</button>
    `;

    area.hidden = false;
    modules.hidden = false;

    document.getElementById("logoutButton")
      .addEventListener("click", async () => {
        await client.auth.signOut();
        location.reload();
      });

    if (
      data.role === "owner" &&
      adminInitializedFor !== user.id &&
      window.initJambareAdmin
    ) {
      adminInitializedFor = user.id;
      await window.initJambareAdmin();
    }
  }

  function queueAccessCheck(session) {
    accessCheck = accessCheck
      .then(() => checkAccess(session))
      .catch(error => {
        console.error("Erreur de vérification :", error);
        showLogin("Erreur de vérification. Recharge la page.");
      });
  }

  document.getElementById("loginForm")
    .addEventListener("submit", async event => {
      event.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      showMessage("Connexion en cours...");

      const { data, error } = await client.auth
        .signInWithPassword({ email, password });

      if (error) {
        showMessage("Connexion impossible : " + error.message);
        return;
      }

      queueAccessCheck(data.session);
      await accessCheck;
    });

  document.getElementById("signupForm")
    .addEventListener("submit", async event => {
      event.preventDefault();

      const fullName =
        document.getElementById("fullName").value.trim();
      const nomGuerre =
        document.getElementById("nomGuerre").value.trim();
      const email =
        document.getElementById("newEmail").value.trim();
      const password =
        document.getElementById("newPassword").value;

      showMessage("Création du compte en cours...");

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            nom_guerre: nomGuerre
          }
        }
      });

      if (error) {
        showMessage("Inscription impossible : " + error.message);
        return;
      }

      if (!data.session) {
        showMessage(
          "Inscription enregistrée. Vérifie ton e-mail. " +
          "Ton accès sera disponible après autorisation."
        );
        return;
      }

      queueAccessCheck(data.session);
      await accessCheck;
    });

  client.auth.onAuthStateChange((event, session) => {
    if (
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT" ||
      event === "TOKEN_REFRESHED"
    ) {
      queueAccessCheck(session);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      showLogin("Impossible de vérifier la session. Recharge la page.");
      return;
    }
    queueAccessCheck(data.session);
  });
})();
