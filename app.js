
(() => {
  const client = () => window.supabaseClient;
  const modules = document.getElementById("modules");
  const startButton = document.getElementById("startButton");

  if (!modules) return;

  if (startButton) {
    startButton.addEventListener("click", () => {
      modules.scrollIntoView({ behavior: "smooth" });
    });
  }

  let currentUser = null;
  let currentRole = null;

  let content = document.getElementById("spaceContent");

  if (!content) {
    content = document.createElement("section");
    content.id = "spaceContent";
    content.style.cssText =
      "background:white;padding:18px;margin-top:18px;border-radius:14px;";
    const grid = modules.querySelector(".module-grid");
    if (grid) grid.after(content);
    else modules.appendChild(content);
  }

  function showMessage(text) {
    content.replaceChildren();
    const p = document.createElement("p");
    p.textContent = text;
    content.appendChild(p);
    content.hidden = false;
  }

  function makeButton(text, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", action);
    return button;
  }

  async function openFormations() {
    if (!currentUser) {
      showMessage("Connecte-toi pour consulter les formations.");
      return;
    }

    showMessage("Chargement des formations...");

    try {
      const { data: courses, error } = await client()
        .from("courses")
        .select("id, title, description, category, level")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      content.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = "Formations JAMBARE";
      content.appendChild(heading);

      content.appendChild(makeButton("← Retour aux espaces", () => {
        content.hidden = true;
      }));

      if (!courses || courses.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Aucune formation publiée pour le moment.";
        content.appendChild(p);
        return;
      }

      for (const course of courses) {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;padding:14px;margin:14px 0;border-radius:12px;";

        const title = document.createElement("h3");
        title.textContent = course.title;
        card.appendChild(title);

        const description = document.createElement("p");
        description.textContent =
          course.description || "Aucune description.";
        card.appendChild(description);

        const details = document.createElement("p");
        details.textContent =
          "Catégorie : " + (course.category || "Non renseignée") +
          " | Niveau : " + course.level;
        card.appendChild(details);

        const lessonArea = document.createElement("div");
        lessonArea.hidden = true;

        const lessonButton = makeButton("Voir les leçons", async () => {
          if (!lessonArea.hidden) {
            lessonArea.hidden = true;
            lessonButton.textContent = "Voir les leçons";
            return;
          }

          lessonArea.hidden = false;
          lessonArea.textContent = "Chargement des leçons...";
          lessonButton.textContent = "Masquer les leçons";

          const { data: lessons, error: lessonError } = await client()
            .from("lessons")
            .select("id, title, content, position")
            .eq("course_id", course.id)
            .eq("is_published", true)
            .order("position", { ascending: true });

          lessonArea.replaceChildren();

          if (lessonError) {
            const p = document.createElement("p");
            p.textContent = "Erreur : " + lessonError.message;
            lessonArea.appendChild(p);
            return;
          }

          if (!lessons || lessons.length === 0) {
            const p = document.createElement("p");
            p.textContent = "Aucune leçon publiée.";
            lessonArea.appendChild(p);
            return;
          }

          lessons.forEach((lesson, index) => {
            const lessonCard = document.createElement("div");
            lessonCard.style.cssText =
              "border-top:1px solid #ddd;padding:12px 0;";

            const lessonTitle = document.createElement("h4");
            lessonTitle.textContent =
              (index + 1) + ". " + lesson.title;

            const lessonContent = document.createElement("p");
            lessonContent.textContent = lesson.content || "";
            lessonContent.style.whiteSpace = "pre-wrap";

            lessonCard.append(lessonTitle, lessonContent);
            lessonArea.appendChild(lessonCard);
          });
        });

        card.append(lessonButton, lessonArea);
        content.appendChild(card);
      }

      content.hidden = false;
    } catch (error) {
      console.error("JAMBARE formations :", error);
      showMessage("Impossible de charger les formations : " + error.message);
    }
  }

  function openOtherSpace(name) {
    if (!currentUser) {
      showMessage("Connecte-toi pour accéder à cet espace.");
      return;
    }

    if (name === "Évaluations") {
      showMessage("L'espace Évaluations sera activé dans la prochaine étape.");
    } else if (name === "Bibliothèque") {
      showMessage("L'espace Bibliothèque sera activé dans la prochaine étape.");
    } else if (name === "Administration") {
      if (currentRole !== "owner" && currentRole !== "admin") {
        showMessage("Accès réservé au propriétaire et aux administrateurs.");
        return;
      }

      const adminPanel = document.getElementById("jambareAdminPanel");
      if (adminPanel) {
        adminPanel.scrollIntoView({ behavior: "smooth" });
      } else {
        showMessage("Connecte-toi avec ton compte propriétaire pour ouvrir l'administration.");
      }
    }
  }

  function activateCards() {
    const cards = modules.querySelectorAll(".module");

    cards.forEach(card => {
      const heading = card.querySelector("h3");
      if (!heading) return;

      const name = heading.textContent.trim();

      card.style.cursor = "pointer";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const action = () => {
        if (name === "Formations") openFormations();
        else openOtherSpace(name);
      };

      card.addEventListener("click", action);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          action();
        }
      });
    });
  }

  async function updateUser(session) {
    currentUser = session?.user || null;
    currentRole = null;

    if (!currentUser) {
      content.hidden = true;
      return;
    }

    const { data, error } = await client()
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Profil JAMBARE :", error);
      showMessage("Impossible de vérifier ton profil.");
      return;
    }

    currentRole = data?.role || null;
  }

  activateCards();

  async function initialize() {
    if (!client()) {
      console.error("Connexion Supabase introuvable.");
      return;
    }

    const { data, error } = await client().auth.getSession();

    if (error) {
      console.error(error);
      return;
    } 

    await updateUser(data.session);

    client().auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        setTimeout(() => updateUser(session), 0);
      }
    });
  }

  initialize();
})();
