
(() => {
  const config = window.JAMBARE_CONFIG;
  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_KEY
  );

  const modules = document.getElementById("modules");
  modules.hidden = true;

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

  function showMessage(text) {
    message.textContent = text;
  }

  async function checkAccess(session) {
    if (!session) {
      modules.hidden = true;
      area.hidden = false;
      showMessage("Connecte-toi ou crée ton compte.");
      return;
    }

    const { data, error } = await client
      .from("profiles")
      .select("full_name, role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      modules.hidden = true;
      showMessage("Profil introuvable. Contacte le propriétaire.");
      return;
    }

    const allowed = ["military", "trainer", "admin", "owner"];

    if (!allowed.includes(data.role)) {
      modules.hidden = true;
      showMessage(
        "Compte en attente d'autorisation. Réessaie plus tard."
      );
      return;
    }

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
  }

  document.getElementById("loginForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      showMessage("Connexion en cours...");

      const { data, error } = await client.auth
        .signInWithPassword({ email, password });

      if (error) {
        showMessage("Connexion impossible : vérifie tes identifiants.");
        return;
      }

      await checkAccess(data.session);
    });

  document.getElementById("signupForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const fullName = document.getElementById("fullName").value;
      const nomGuerre = document.getElementById("nomGuerre").value;
      const email = document.getElementById("newEmail").value;
      const password = document.getElementById("newPassword").value;

      showMessage("Création du compte en cours...");

      const { error } = await client.auth.signUp({
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

      showMessage(
        "Inscription enregistrée. Vérifie ton e-mail, puis attends l'autorisation du propriétaire."
      );
    });

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      await checkAccess(session);
    }
  });

  client.auth.getSession().then(({ data }) => {
    checkAccess(data.session);
  });
})();
