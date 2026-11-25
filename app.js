
(() => {
  "use strict";

  const client = () => window.supabaseClient;
  const modules = document.getElementById("modules");
  const startButton = document.getElementById("startButton");

  if (!modules) {
    console.error("JAMBARE : espace modules introuvable.");
    return;
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

  content.hidden = true;

  function showMessage(message) {
    content.replaceChildren();
    const p = document.createElement("p");
    p.textContent = message;
    content.appendChild(p);
    content.hidden = false;
  }

  function addTitle(text) {
    const h = document.createElement("h2");
    h.textContent = text;
    content.appendChild(h);
  }

  function makeButton(text, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", action);
    return button;
  }

  function addBackButton() {
    content.appendChild(
      makeButton("← Retour aux espaces", () => {
        content.hidden = true;
        modules.scrollIntoView({ behavior: "smooth" });
      })
    );
  }

  function requireLogin() {
    if (currentUser) return true;
    showMessage("Connecte-toi pour accéder à cet espace.");
    return false;
  }

  // FORMATIONS
  async function openFormations() {
    if (!requireLogin()) return;

    showMessage("Chargement des formations...");

    try {
      const { data: courses, error } = await client()
        .from("courses")
        .select("id,title,description,category,level")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      content.replaceChildren();
      addTitle("Formations JAMBARE");
      addBackButton();

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

        const description = document.createElement("p");
        description.textContent =
          course.description || "Aucune description.";

        const details = document.createElement("p");
        details.textContent =
          "Catégorie : " + (course.category || "Non renseignée") +
          " | Niveau : " + course.level;

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
            .select("id,title,content,position")
            .eq("course_id", course.id)
            .eq("is_published", true)
            .order("position", { ascending: true });

          lessonArea.replaceChildren();

          if (lessonError) {
            lessonArea.textContent =
              "Impossible de charger les leçons : " + lessonError.message;
            return;
          }

          if (!lessons || lessons.length === 0) {
            lessonArea.textContent = "Aucune leçon publiée.";
            return;
          }

          lessons.forEach((lesson, index) => {
            const block = document.createElement("div");
            block.style.cssText =
              "border-top:1px solid #ddd;padding:12px 0;";

            const h = document.createElement("h4");
            h.textContent = (index + 1) + ". " + lesson.title;

            const p = document.createElement("p");
            p.textContent = lesson.content || "";
            p.style.whiteSpace = "pre-wrap";

            block.append(h, p);
            lessonArea.appendChild(block);
          });
        });

        card.append(title, description, details, lessonButton, lessonArea);
        content.appendChild(card);
      }

      content.hidden = false;
    } catch (error) {
      console.error("JAMBARE formations :", error);
      showMessage("Erreur de chargement : " + error.message);
    }
  }

  // ÉVALUATIONS
  async function openAssessments() {
    if (!requireLogin()) return;

    showMessage("Chargement des examens...");

    try {
      const { data: exams, error } = await client()
        .from("assessments")
        .select("id,title,description,duration_minutes")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      content.replaceChildren();
      addTitle("Évaluations JAMBARE");
      addBackButton();

      if (!exams || exams.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Aucun examen publié pour le moment.";
        content.appendChild(p);
        return;
      }

      for (const exam of exams) {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;padding:16px;margin:14px 0;border-radius:12px;";

        const h = document.createElement("h3");
        h.textContent = exam.title;

        const description = document.createElement("p");
        description.textContent =
          exam.description || "Aucune description.";

        const duration = document.createElement("p");
        duration.textContent =
          "Durée : " +
          (exam.duration_minutes || "Non précisée") +
          (exam.duration_minutes ? " minutes" : "");

        const button = makeButton("Commencer l'examen", () => {
          startExam(exam);
        });

        card.append(h, description, duration, button);
        content.appendChild(card);
      }

      content.hidden = false;
    } catch (error) {
      console.error("JAMBARE évaluations :", error);
      showMessage("Impossible de charger les examens : " + error.message);
    }
  }

  // DÉMARRER UN EXAMEN
  async function startExam(exam) {
    showMessage("Préparation de l'examen...");

    try {
      const { data: questions, error } = await client()
        .from("assessment_questions")
        .select("id,prompt,options,position")
        .eq("assessment_id", exam.id)
        .order("position", { ascending: true });

      if (error) throw error;

      if (!questions || questions.length === 0) {
        showMessage("Cet examen ne contient aucune question.");
        return;
      }

      content.replaceChildren();
      addTitle(exam.title);

      const description = document.createElement("p");
      description.textContent =
        exam.description || "Réponds aux questions puis soumets ton examen.";
      content.appendChild(description);

      const count = document.createElement("p");
      count.textContent = questions.length + " question(s)";
      content.appendChild(count);

      const form = document.createElement("form");
      form.style.cssText = "margin-top:18px;";

      questions.forEach((question, index) => {
        const block = document.createElement("fieldset");
        block.style.cssText =
          "border:1px solid #ddd;border-radius:10px;padding:14px;margin:16px 0;";

        const legend = document.createElement("legend");
        legend.textContent =
          "Question " + (index + 1) + " : " + question.prompt;
        legend.style.fontWeight = "bold";
        block.appendChild(legend);

        let options = question.options;

        if (typeof options === "string") {
          try {
            options = JSON.parse(options);
          } catch {
            options = [];
          }
        }

        if (!Array.isArray(options)) options = [];

        if (options.length === 0) {
          const warning = document.createElement("p");
          warning.textContent = "Les choix de réponse ne sont pas disponibles.";
          block.appendChild(warning);
        }

        options.forEach((option, optionIndex) => {
          const label = document.createElement("label");
          label.style.cssText =
            "display:block;padding:9px 4px;cursor:pointer;";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = question.id;
          radio.value = String(optionIndex);
          radio.style.marginRight = "10px";

          const optionText =
            typeof option === "object" && option !== null
              ? (option.text || option.label || JSON.stringify(option))
              : String(option);

          label.append(radio, document.createTextNode(optionText));
          block.appendChild(label);
        });

        form.appendChild(block);
      });

      const submit = makeButton("Soumettre mes réponses", async () => {
        if (submit.disabled) return;

        const answers = {};

        questions.forEach(question => {
          const selected = form.querySelector(
            'input[name="' + question.id + '"]:checked'
          );

          if (selected) {
            answers[question.id] = Number(selected.value);
          }
        });

        const answeredCount = Object.keys(answers).length;

        if (answeredCount === 0) {
          alert("Choisis au moins une réponse avant de soumettre.");
          return;
        }

        if (
          answeredCount < questions.length &&
          !confirm(
            "Tu as répondu à " + answeredCount + " question(s) sur " +
            questions.length + ". Soumettre quand même ?"
          )
        ) {
          return;
        }

        submit.disabled = true;
        submit.textContent = "Correction en cours...";

        try {
          const { data, error } = await client().rpc(
            "grade_assessment",
            {
              p_assessment_id: exam.id,
              p_answers: answers
            }
          );

          if (error) throw error;

          const result = Array.isArray(data) ? data[0] : data;

          if (!result) {
            throw new Error("Aucun résultat reçu.");
          }

          showExamResult(result);
        } catch (error) {
          console.error("Correction JAMBARE :", error);
          alert("La correction a échoué : " + error.message);
          submit.disabled = false;
          submit.textContent = "Soumettre mes réponses";
        }
      });

      submit.style.display = "block";
      form.appendChild(submit);

      content.appendChild(form);
      content.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Chargement de l'examen :", error);
      showMessage("Impossible de démarrer l'examen : " + error.message);
    }
  }

  // AFFICHER LE RÉSULTAT APRÈS CORRECTION
  function showExamResult(result) {
    content.replaceChildren();
    addTitle("Résultat de ton examen");

    const score = Number(result.score);
    const total = Number(result.total_questions);
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    const summary = document.createElement("div");
    summary.style.cssText =
      "background:#eef5ef;padding:18px;border-radius:12px;margin:16px 0;";

    const note = document.createElement("h2");
    note.textContent = score + " / " + total;

    const percent = document.createElement("p");
    percent.textContent = "Résultat : " + percentage + " %";

    const status = document.createElement("p");
    status.style.fontWeight = "bold";
    status.textContent =
      percentage >= 70
        ? "Bravo ! Seuil de réussite atteint."
        : "Continue tes révisions. Tu peux progresser.";

    summary.append(note, percent, status);
    content.appendChild(summary);

    const heading = document.createElement("h3");
    heading.textContent = "Correction détaillée";
    content.appendChild(heading);

    let results = result.results;

    if (typeof results === "string") {
      try {
        results = JSON.parse(results);
      } catch {
        results = [];
      }
    }

    if (Array.isArray(results)) {
      results.forEach((item, index) => {
        const block = document.createElement("article");
        block.style.cssText =
          "border:1px solid #ddd;padding:14px;margin:12px 0;border-radius:10px;";

        const title = document.createElement("h4");
        title.textContent =
          "Question " + (index + 1) +
          (item.is_correct ? " — Bonne réponse" : " — Réponse incorrecte");

        const answer = document.createElement("p");
        answer.textContent =
          item.selected_index === null
            ? "Ta réponse : aucune réponse"
            : "Ta réponse : choix " + (Number(item.selected_index) + 1);

        const correct = document.createElement("p");
        correct.textContent =
          "Bonne réponse : choix " + (Number(item.correct_index) + 1);

        const explanation = document.createElement("p");
        explanation.textContent =
          "Explication : " + (item.explanation || "Aucune explication fournie.");

        block.append(title, answer, correct, explanation);
        content.appendChild(block);
      });
    }

    content.appendChild(
      makeButton("Retour aux examens", openAssessments)
    );

    content.appendChild(
      makeButton("Retour aux espaces", () => {
        content.hidden = true;
        modules.scrollIntoView({ behavior: "smooth" });
      })
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // AUTRES ESPACES
  function openOtherSpace(name) {
    if (!requireLogin()) return;

    if (name === "Bibliothèque") {
      showMessage(
        "L'espace Bibliothèque sera activé dans une prochaine étape."
      );
      return;
    }

    if (name === "Administration") {
      if (currentRole !== "owner" && currentRole !== "admin") {
        showMessage(
          "Accès réservé au propriétaire et aux administrateurs."
        );
        return;
      }

      const panel = document.getElementById("jambareAdminPanel");

      if (panel) {
        panel.scrollIntoView({ behavior: "smooth" });
      } else {
        showMessage("Le panneau d'administration n'est pas disponible.");
      }
    }
  }

  // CLICS SUR LES ESPACES
  modules.addEventListener("click", event => {
    const card = event.target.closest(".module");
    if (!card) return;

    const heading = card.querySelector("h3");
    if (!heading) return;

    const name = heading.textContent.trim();

    if (name === "Formations") {
      openFormations();
    } else if (name === "Évaluations") {
      openAssessments();
    } else {
      openOtherSpace(name);
    }
  });

  if (startButton) {
    startButton.addEventListener("click", () => {
      modules.scrollIntoView({ behavior: "smooth" });
    });
  }

  // IDENTIFICATION DE L'UTILISATEUR
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
      return;
    }

    currentRole = data?.role || null;
  }

  // INITIALISATION
  async function initialize() {
    if (!client()) {
      console.error("Client Supabase introuvable.");
      return;
    }

    const { data, error } = await client().auth.getSession();

    if (error) {
      console.error("Session JAMBARE :", error);
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
