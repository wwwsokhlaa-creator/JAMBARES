
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
    <h2>Bienvenue sur JAMBARE</h2>
    <p id="authMessage">
      Connecte-toi ou crée gratuitement ton compte militaire.
    </p>

    <h3>Connexion</h3>
    <form id="loginForm">
      <input id="loginIdentifier" type="text"
        placeholder="E-mail ou téléphone (+221...)"
        required>
      <input id="loginPassword" type="password"
        placeholder="Mot de passe" required>
      <button type="submit">Se connecter</button>
    </form>

    <hr>

    <h3>Créer un compte militaire</h3>
    <form id="signupForm">
      <input id="fullName" type="text"
        placeholder="Prénom et nom" required>
      <input id="nomGuerre" type="text"
        placeholder="Nom de guerre" required>
      <input id="newIdentifier" type="text"
        placeholder="E-mail ou téléphone (+221...)"
        required>
      <input id="newPassword" type="password"
        placeholder="Mot de passe (8 caractères minimum)"
        minlength="8" required>
      <button type="submit">Créer mon compte</button>
    </form>
  `;

  const message = document.getElementById("authMessage");
  let accessCheck = Promise.resolve();
  let adminInitializedFor = null;

  function showMessage(text) {
    message.textContent = text;
  }

  function showLogin(text) {
    modules.hidden = true;
    area.hidden = false;
    showMessage(text);
  }

  function isEmail(value) {
    return value.includes("@");
  }

  function normalizePhone(value) {
    return value.replace(/[\s().-]/g, "");
  }

  async function checkAccess(session) {
    if (!session) {
      window.JAMBARE_AUTH_USER = null;
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
      console.error("Erreur profil :", error);
      showLogin("Profil introuvable. Contacte le propriétaire.");
      return;
    }

    const allowed = ["owner", "admin", "trainer", "military"];

    if (!allowed.includes(data.role)) {
      window.JAMBARE_AUTH_USER = null;
      await client.auth.signOut();
      showLogin("Ton compte ne dispose pas encore d'un accès.");
      return;
    }

    window.JAMBARE_AUTH_USER = user;

    area.innerHTML = `
      <h2>Bienvenue sur JAMBARE</h2>
      <p id="welcomeRole"></p>
      <button id="logoutButton">Se déconnecter</button>
    `;

    document.getElementById("welcomeRole").textContent =
      "Accès autorisé : " + data.role;

    area.hidden = false;
    modules.hidden = false;

    document.getElementById("logoutButton")
      .addEventListener("click", async () => {
        await client.auth.signOut();
        location.reload();
      });

    if (data.role === "owner" && adminInitializedFor !== user.id) {
      adminInitializedFor = user.id;

      if (typeof window.initJambareAdmin === "function") {
        await window.initJambareAdmin(user);
      } else {
        window.dispatchEvent(new Event("jambare:owner-ready"));
      }
    }
  }

  function queueAccessCheck(session) {
    accessCheck = accessCheck
      .then(() => checkAccess(session))
      .catch(error => {
        console.error("Erreur de vérification :", error);
        showLogin("Erreur : " + error.message);
      });

    return accessCheck;
  }

  document.getElementById("loginForm")
    .addEventListener("submit", async event => {
      event.preventDefault();

      const identifier =
        document.getElementById("loginIdentifier").value.trim();
      const password =
        document.getElementById("loginPassword").value;

      showMessage("Connexion en cours...");

      const credentials = isEmail(identifier)
        ? { email: identifier, password }
        : { phone: normalizePhone(identifier), password };

      const { data, error } = await client.auth
        .signInWithPassword(credentials);

      if (error) {
        showMessage("Connexion impossible : " + error.message);
        return;
      }

      await queueAccessCheck(data.session);
    });

  document.getElementById("signupForm")
    .addEventListener("submit", async event => {
      event.preventDefault();

      const fullName =
        document.getElementById("fullName").value.trim();
      const nomGuerre =
        document.getElementById("nomGuerre").value.trim();
      const identifier =
        document.getElementById("newIdentifier").value.trim();
      const password =
        document.getElementById("newPassword").value;

      if (password.length < 8) {
        showMessage("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }

      showMessage("Création du compte en cours...");

      const options = {
        data: {
          full_name: fullName,
          nom_guerre: nomGuerre
        }
      };

      let result;

      if (isEmail(identifier)) {
        result = await client.auth.signUp({
          email: identifier,
          password,
          options
        });
      } else {
        const phone = normalizePhone(identifier);

        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
          showMessage("Entre un numéro au format international, par exemple +221771234567.");
          return;
        }

        result = await client.auth.signUp({
          phone,
          password,
          options
        });
      }

      const { data, error } = result;

      if (error) {
        showMessage("Inscription impossible : " + error.message);
        return;
      }

      if (!data.session) {
        showMessage(
          "Compte créé. Une confirmation est encore nécessaire. " +
          "Vérifie les réglages de confirmation dans Supabase."
        );
        return;
      }

      await queueAccessCheck(data.session);
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
