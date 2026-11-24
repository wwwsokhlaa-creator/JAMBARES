
(() => {
  let loading = false;
  let panel = null;

  function showStatus(text) {
    const status = document.getElementById("jambare-admin-status");
    if (status) status.textContent = text;
  }

  async function initJambareAdmin(user) {
    if (loading) return;
    loading = true;

    try {
      const client = window.supabaseClient;

      if (!client) {
        throw new Error("Connexion Supabase introuvable.");
      }

      if (!user) {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        user = data.user;
      }

      if (!user) {
        throw new Error("Aucun utilisateur connecté.");
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role !== "owner") {
        throw new Error("Accès réservé au propriétaire.");
      }

      panel = document.getElementById("jambare-admin");

      if (!panel) {
        panel = document.createElement("section");
        panel.id = "jambare-admin";

        const modules = document.getElementById("modules");

        if (modules) {
          modules.after(panel);
        } else {
          document.body.appendChild(panel);
        }
      }

      panel.innerHTML = `
        <div style="
          background:#14251b;
          color:white;
          padding:20px;
          margin:20px 0;
          border-radius:12px;
        ">
          <h2>ESPACE PROPRIÉTAIRE JAMBARE</h2>
          <p id="jambare-owner-name"></p>
          <p id="jambare-admin-status">Chargement...</p>

          <hr>
          <h3>Gestion des militaires</h3>
          <button id="refresh-users">Actualiser les comptes</button>
          <div id="admin-users">Chargement des comptes...</div>

          <hr>
          <h3>Formations</h3>
          <button id="refresh-courses">Actualiser les formations</button>
          <div id="admin-courses">Chargement des formations...</div>
        </div>
      `;

      document.getElementById("jambare-owner-name").textContent =
        "Propriétaire : " + (profile.full_name || "JAMBARE");

      document.getElementById("refresh-users").onclick =
        () => loadUsers(client);

      document.getElementById("refresh-courses").onclick =
        () => loadCourses(client);

      await loadUsers(client);
      await loadCourses(client);

      showStatus("Espace propriétaire chargé.");
    } catch (error) {
      console.error("Erreur administration JAMBARE :", error);
      showStatus("Erreur : " + error.message);
    } finally {
      loading = false;
    }
  }

  async function loadUsers(client) {
    const area = document.getElementById("admin-users");
    if (!area) return;

    area.textContent = "Chargement des comptes...";

    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, nom_guerre, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      area.textContent = "Erreur : " + error.message;
      return;
    }

    area.innerHTML = "";

    if (!data || data.length === 0) {
      area.textContent = "Aucun compte enregistré.";
      return;
    }

    data.forEach(user => {
      const card = document.createElement("div");
      card.style.cssText =
        "background:white;color:#222;padding:12px;margin:10px 0;border-radius:8px;";

      const name = document.createElement("strong");
      name.textContent = user.full_name || "Nom non renseigné";

      const details = document.createElement("p");
      details.textContent =
        "Nom de guerre : " + (user.nom_guerre || "Non renseigné") +
        " | Rôle : " + user.role;

      card.append(name, details);

      if (user.role !== "owner") {
        const select = document.createElement("select");
        select.style.cssText = "padding:8px;max-width:100%;";

        const roles = [
          ["pending", "En attente"],
          ["military", "Militaire autorisé"],
          ["trainer", "Formateur"],
          ["admin", "Administrateur"]
        ];

        roles.forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          select.appendChild(option);
        });

        select.value = roles.some(([value]) => value === user.role)
          ? user.role
          : "pending";

        const button = document.createElement("button");
        button.textContent = "Enregistrer le rôle";
        button.style.margin = "8px";

        button.onclick = async () => {
          button.disabled = true;
          button.textContent = "Enregistrement...";

          const { error } = await client.rpc("set_jambare_role", {
            p_user_id: user.id,
            p_new_role: select.value
          });

          button.disabled = false;
          button.textContent = "Enregistrer le rôle";

          if (error) {
            alert("Modification impossible : " + error.message);
          } else {
            alert("Rôle mis à jour.");
            await loadUsers(client);
          }
        };

        card.append(select, button);
      }

      area.appendChild(card);
    });
  }

  async function loadCourses(client) {
    const area = document.getElementById("admin-courses");
    if (!area) return;

    area.textContent = "Chargement des formations...";

    const { data, error } = await client
      .from("courses")
      .select("*");

    if (error) {
      area.textContent = "Erreur : " + error.message;
      return;
    }

    area.textContent = data && data.length
      ? data.length + " formation(s) enregistrée(s)."
      : "Aucune formation enregistrée pour le moment.";
  }

  window.initJambareAdmin = initJambareAdmin;

  window.addEventListener("jambare:owner-ready", () => {
    initJambareAdmin(window.JAMBARE_AUTH_USER);
  });

  if (window.JAMBARE_AUTH_USER) {
    initJambareAdmin(window.JAMBARE_AUTH_USER);
  }
})();
