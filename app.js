
(() => {
  const db = () => window.supabaseClient;
  const modules = document.getElementById("modules");
  const startButton = document.getElementById("startButton");

  if (startButton && modules) {
    startButton.addEventListener("click", () => {
      modules.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function message(text) {
    if (!modules) return;
    modules.textContent = text;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  async function loadMilitarySpace(user) {
    if (!modules) return;

    try {
      if (!user) {
        message("Connectez-vous pour accéder aux formations JAMBARE.");
        return;
      }

      const client = db();
      if (!client) throw new Error("Connexion Supabase introuvable.");

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const allowedRoles = ["military", "trainer", "admin", "owner"];

      if (!profile || !allowedRoles.includes(profile.role)) {
        message("Votre compte est en attente d'autorisation.");
        return;
      }

      message("Chargement des formations...");

      const { data: courses, error } = await client
        .from("courses")
        .select("id, title, description, category, level")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      modules.innerHTML = "";

      modules.appendChild(element("h2", "ESPACE DE FORMATION JAMBARE"));
      modules.appendChild(element(
        "p",
        "Bienvenue " + (profile.full_name || "Militaire autorisé") + "."
      ));

      if (!courses || courses.length === 0) {
        modules.appendChild(element(
          "p",
          "Aucune formation publiée pour le moment."
        ));
        return;
      }

      for (const course of courses) {
        const card = element("article");
        card.style.cssText =
          "background:white;color:#222;padding:16px;margin:14px 0;border-radius:12px;";

        card.appendChild(element("h3", course.title));
        card.appendChild(element(
          "p",
          course.description || "Aucune description."
        ));
        card.appendChild(element(
          "p",
          "Catégorie : " + (course.category || "Non renseignée") +
          " | Niveau : " + course.level
        ));

        const button = element("button", "Voir les leçons");
        button.type = "button";

        const lessonArea = element("div");
        lessonArea.hidden = true;

        button.addEventListener("click", async () => {
          if (!lessonArea.hidden) {
            lessonArea.hidden = true;
            button.textContent = "Voir les leçons";
            return;
          }

          lessonArea.hidden = false;
          lessonArea.textContent = "Chargement des leçons...";
          button.textContent = "Masquer les leçons";

          const { data: lessons, error: lessonError } = await client
            .from("lessons")
            .select("id, title, content, position")
            .eq("course_id", course.id)
            .eq("is_published", true)
            .order("position", { ascending: true });

          lessonArea.innerHTML = "";

          if (lessonError) {
            lessonArea.appendChild(element(
              "p",
              "Impossible de charger les leçons : " + lessonError.message
            ));
            return;
          }

          if (!lessons || lessons.length === 0) {
            lessonArea.appendChild(element(
              "p",
              "Aucune leçon publiée pour cette formation."
            ));
            return;
          }

          lessons.forEach((lesson, index) => {
            const lessonCard = element("div");
            lessonCard.style.cssText =
              "border-top:1px solid #ddd;padding:12px 0;";

            lessonCard.appendChild(element(
              "h4",
              (index + 1) + ". " + lesson.title
            ));

            const content = element("p", lesson.content);
            content.style.whiteSpace = "pre-wrap";
            lessonCard.appendChild(content);

            lessonArea.appendChild(lessonCard);
          });
        });

        card.append(button, lessonArea);
        modules.appendChild(card);
      }

    } catch (error) {
      console.error("JAMBARE :", error);
      message("Erreur de chargement : " + error.message);
    }
  }

  async function initialize() {
    const client = db();

    if (!client) {
      message("Connexion Supabase indisponible.");
      return;
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      message("Erreur de connexion : " + error.message);
      return;
    }

    loadMilitarySpace(data.session?.user || null);

    client.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        loadMilitarySpace(session?.user || null);
      }
    });
  }

  initialize();
})();
