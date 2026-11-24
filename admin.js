
(() => {
  let loading = false;

  async function initAdmin() {
    if (loading) return;
    loading = true;

    let panel;

    try {
      const client = window.supabaseClient;

      if (!client) {
        throw new Error("Connexion Supabase introuvable.");
      }

      const { data: userData, error: userError } =
        await client.auth.getUser();

      if (userError) throw userError;

      const user = userData?.user;
      if (!user) return;

      const { data: profile, error: profileError } =
        await client.from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role !== "owner") return;

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
        <div style="background:#14251b;color:white;padding:20px;border-radius:12px;margin:20px 0;">
          <h2>ESPACE PROPRIÉTAIRE JAMBARE</h2>
          <p>Bienvenue ${escapeText(profile.full_name || "Propriétaire")}</p>
          <hr>
          <h3>Gestion des militaires</h3>
          <div id="admin-users">Chargement des comptes...</div>
          <hr>
          <h3>Formations disponibles</h3>
          <div id="admin-courses">Chargement des formations...</div>
          <p id="admin-message"></p>
        </div>
      `;

      await loadUsers(client);
      await loadCourses(client);

    } catch (error) {
      console.error("JAMBARE ADMIN :", error);

      if (panel) {
        const message = panel.querySelector("#admin-message");
        if (message) {
          message.textContent = "Erreur : " + error.message;
        }
      }
    } finally {
      loading = false;
    }
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  async function loadUsers(client) {
    const area = document.getElementById("admin-users");

    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, nom_guerre, role")
      .order("created_at", { ascending: false });

    if (error) {
      area.textContent = "Erreur de chargement : " + error.message;
      return;
    }

    area.innerHTML = "";

    if (!data || data.length === 0) {
      area.textContent = "Aucun compte trouvé.";
      return;
    }

    data.forEach(user => {
      const item = document.createElement("div");
      item.style.cssText =
        "background:#fff;color:#222;padding:12px;margin:10px 0;border-radius:8px;";

      const name = document.createElement("strong");
      name.textContent = user.full_name || "Nom non renseigné";

      const details = document.createElement("p");
      details.textContent =
        "Nom de guerre : " + (user.nom_guerre || "Non renseigné") +
        " | Rôle : " + user.role;

      item.append(name, details);

      if (user.role !== "owner") {
        const select = document.createElement("select");

        [
          ["pending", "En attente"],
          ["military", "Militaire autorisé"],
          ["trainer", "Formateur"],
          ["admin", "Administrateur"]
        ].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          select.appendChild(option);
        });

        select.value = user.role;

        const button = document.createElement("button");
        button.textContent = "Enregistrer le rôle";
        button.style.margin = "8px";

        button.onclick = async () => {
          button.disabled = true;

          const { error } = await client.rpc(
            "set_jambare_role",
            {
              p_user_id: user.id,
              p_new_role: select.value
            }
          );

          button.disabled = false;

          if (error) {
            alert("Erreur : " + error.message);
          } else {
            alert("Rôle mis à jour.");
            await loadUsers(client);
          }
        };

        item.append(select, button);
      }

      area.appendChild(item);
    });
  }

  async function loadCourses(client) {
    const area = document.getElementById("admin-courses");

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

  window.initJambareAdmin = initAdmin;
})();
