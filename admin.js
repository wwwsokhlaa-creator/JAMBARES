
(() => {
  async function initAdmin() {
    const client = window.supabaseClient || null;

    if (!client) {
      console.error("Connexion Supabase introuvable.");
      return;
    }

    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;

    if (!user) return;

    const { data: profile, error } = await client
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (error || profile?.role !== "owner") return;

    if (document.getElementById("jambare-admin")) return;

    const panel = document.createElement("section");
    panel.id = "jambare-admin";
    panel.style.cssText = `
      margin:25px 16px;
      padding:24px;
      background:#ffffff;
      border-radius:18px;
      color:#18352a;
      box-shadow:0 4px 18px #0001;
    `;

    panel.innerHTML = `
      <h2>Tableau de bord propriétaire</h2>
      <p>Bienvenue dans votre espace de gestion JAMBARE.</p>
      <div id="jambare-stats">Chargement des statistiques...</div>
      <h3>Demandes d'accès en attente</h3>
      <div id="jambare-pending">Chargement...</div>
      <p style="font-size:12px;color:#777">
        Espace réservé au propriétaire.
      </p>
    `;

    document.body.appendChild(panel);

    const tables = [
      ["Militaires", "profiles"],
      ["Formations", "courses"],
      ["Examens", "exams"],
      ["Documents", "library_documents"]
    ];

    const stats = document.getElementById("jambare-stats");
    stats.innerHTML = "";

    for (const [label, table] of tables) {
      const { count, error: countError } = await client
        .from(table)
        .select("*", { count: "exact", head: true });

      const item = document.createElement("div");
      item.style.cssText =
        "padding:12px;margin:8px 0;background:#eef3ef;border-radius:10px";

      item.textContent = label + " : " +
        (countError ? "Indisponible" : count);

      stats.appendChild(item);
    }

    const { data: pending, error: pendingError } = await client
      .from("profiles")
      .select("id, full_name, nom_guerre, created_at")
      .eq("role", "pending")
      .order("created_at", { ascending: false });

    const pendingBox = document.getElementById("jambare-pending");
    pendingBox.innerHTML = "";

    if (pendingError) {
      pendingBox.textContent =
        "Impossible de charger les demandes pour le moment.";
      return;
    }

    if (!pending || pending.length === 0) {
      pendingBox.textContent = "Aucune demande en attente.";
      return;
    }

    pending.forEach(person => {
      const item = document.createElement("div");
      item.style.cssText =
        "padding:12px;margin:8px 0;background:#eef3ef;border-radius:10px";

      const name = document.createElement("strong");
      name.textContent =
        person.full_name || person.nom_guerre || "Militaire sans nom";

      item.appendChild(name);
      pendingBox.appendChild(item);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
