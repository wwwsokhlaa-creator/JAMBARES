
(() => {
  alert("Le fichier admin.js est chargé !");
  async function initAdmin() {
    alert("Le fichier admin.js est exécuté.");
    const client = window.supabaseClient;

    if (!client) {
      console.error("Connexion Supabase introuvable.");
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;

alert(user ? "Session Supabase active !" : "Aucune session Supabase !");
if (!user) return;

    const { data: profile, error } = await client
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (error) {
  console.error("Erreur profil administration :", error);
  return;
}
if (profile?.role !== "owner") {
  console.error("Rôle détecté :", profile?.role);
  return;
}

    if (document.getElementById("jambare-admin")) return;

    const panel = document.createElement("section");
    panel.id = "jambare-admin";
    panel.style.cssText =
      "margin:25px 16px;padding:22px;background:white;border-radius:18px;color:#18352a;box-shadow:0 4px 18px #0001;";

    panel.innerHTML = `
      <h2>Administration JAMBARE</h2>
      <p>Espace réservé au propriétaire</p>

      <h3>Demandes d'inscription</h3>
      <div id="pending-users">Chargement...</div>

      <h3>Utilisateurs autorisés</h3>
      <div id="approved-users">Chargement...</div>

      <h3>Formations</h3>
      <div id="course-list">Chargement...</div>
    `;

    const modules = document.getElementById("modules");
    if (modules) modules.before(panel);
    else document.body.appendChild(panel);

    async function loadUsers() {
      const pendingBox = document.getElementById("pending-users");
      const approvedBox = document.getElementById("approved-users");

      const { data, error } = await client
        .from("profiles")
        .select("id, full_name, nom_guerre, role, created_at")
        .neq("role", "owner")
        .order("created_at", { ascending: false });

      if (error) {
        pendingBox.textContent = "Erreur de chargement des utilisateurs.";
        approvedBox.textContent = "Erreur de chargement.";
        return;
      }

      pendingBox.innerHTML = "";
      approvedBox.innerHTML = "";

      const pending = data.filter(u => u.role === "pending");
      const approved = data.filter(u => u.role !== "pending");

      if (!pending.length) {
        pendingBox.textContent = "Aucune demande en attente.";
      }

      pending.forEach(person => {
        const item = document.createElement("div");
        item.style.cssText = "padding:12px;margin:8px 0;background:#f1f5f2;border-radius:10px;";

        const name = document.createElement("p");
        name.textContent = person.full_name || person.nom_guerre || "Militaire";
        item.appendChild(name);

        ["military", "trainer", "admin"].forEach(role => {
          const button = document.createElement("button");
          button.textContent = role === "military" ? "Autoriser militaire" :
            role === "trainer" ? "Autoriser formateur" : "Nommer administrateur";
          button.style.cssText = "margin:4px;padding:9px;background:#214b38;color:white;border:0;border-radius:7px;";
          button.onclick = async () => {
            if (!confirm("Confirmer cette attribution de rôle ?")) return;

            const { error } = await client.rpc("set_jambare_role", {
              p_user_id: person.id,
              p_new_role: role
            });

            if (error) {
              alert("Erreur : " + error.message);
            } else {
              alert("Rôle attribué.");
              loadUsers();
            }
          };
          item.appendChild(button);
        });

        pendingBox.appendChild(item);
      });

      if (!approved.length) {
        approvedBox.textContent = "Aucun utilisateur autorisé.";
      }

      approved.forEach(person => {
        const item = document.createElement("p");
        item.textContent =
          `${person.full_name || person.nom_guerre || "Utilisateur"} — ${person.role}`;
        approvedBox.appendChild(item);
      });
    }

    async function loadCourses() {
      const box = document.getElementById("course-list");
      const { data, error } = await client
        .from("courses")
        .select("id, title, category, is_published")
        .order("created_at", { ascending: false });

      box.innerHTML = "";

      if (error) {
        box.textContent = "Impossible de charger les formations.";
        return;
      }

      if (!data.length) {
        box.textContent = "Aucune formation enregistrée.";
        return;
      }

      data.forEach(course => {
        const item = document.createElement("p");
        item.textContent =
          `${course.title} — ${course.category || "Sans catégorie"} — ${course.is_published ? "Publié" : "Brouillon"}`;
        box.appendChild(item);
      });
    }

    await loadUsers();
    await loadCourses();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }

  window.initJambareAdmin = initAdmin;
})();
