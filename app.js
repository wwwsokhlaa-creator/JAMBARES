
(() => {
  const client = () => window.supabaseClient;
  const modules = document.getElementById("modules");
  const startButton = document.getElementById("startButton");

  if (!modules) return;

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

  function makeButton(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function backButton() {
    return makeButton("← Retour aux espaces", () => {
      content.hidden = true;
      modules.scrollIntoView({ behavior: "smooth" });
    });
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
        .select("id,title,description,category,level")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      content.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = "Formations JAMBARE";
      content.append(heading, backButton());

      if (!courses || courses.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Aucune formation publiée pour le moment.";
        content.appendChild(p);
      }

      for (const course of courses || []) {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;padding:14px;margin:14px 0;border-radius:12px;";

        const title = document.createElement("h3");
        title.textContent = course.title;

        const description = document.createElement("p");
        description.textContent = course.description || "Aucune description.";

        const details = document.createElement("p");
        details.textContent =
          "Catégorie : " + (course.category || "Non renseignée") +
          " | Niveau : " + course.level;

        const lessonArea = document.createElement("div");
        lessonArea.hidden = true;

        const lessonButton = makeButton("Voir les leçons", async () => {
          lessonArea.hidden = false;
          lessonArea.textContent = "Chargement des leçons...";

          const { data: lessons, error: lessonError } = await client()
            .from("lessons")
            .select("id,title,content,position")
            .eq("course_id", course.id)
            .eq("is_published", true)
            .order("position", { ascending: true });

          lessonArea.replaceChildren();

          if (lessonError) {
            lessonArea.textContent = "Erreur : " + lessonError.message;
            return;
          }

          if (!lessons || lessons.length === 0) {
            lessonArea.textContent = "Aucune leçon publiée.";
            return;
          }

          lessons.forEach((lesson, index) => {
            const item = document.createElement("div");
            item.style.cssText = "border-top:1px solid #ddd;padding:12px 0;";

            const h = document.createElement("h4");
            h.textContent = (index + 1) + ". " + lesson.title;

            const p = document.createElement("p");
            p.textContent = lesson.content || "";
            p.style.whiteSpace = "pre-wrap";

            item.append(h, p);
            lessonArea.appendChild(item);
          });
        });

        card.append(title, description, details, lessonButton, lessonArea);
        content.appendChild(card);
      }

      content.hidden = false;
    } catch (error) {
      console.error(error);
      showMessage("Erreur lors du chargement : " + error.message);
    }
  }

  async function openHistory() {
    if (!currentUser) {
      showMessage("Connecte-toi pour consulter ton historique.");
      return;
    }

    showMessage("Chargement de ton historique...");

    try {
      const { data: history, error } = await client()
        .rpc("get_my_assessment_history");

      if (error) throw error;

      content.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = "Mon historique des examens";
      content.append(heading, backButton());

      if (!history || history.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Tu n'as pas encore passé d'examen.";
        content.appendChild(p);
        content.hidden = false;
        return;
      }

      history.forEach(attempt => {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;border-radius:12px;padding:16px;margin:14px 0;";

        const title = document.createElement("h3");
        title.textContent = attempt.assessment_title || "Examen";

        const score = document.createElement("p");
        score.textContent =
          "Score : " + attempt.score + " / " + attempt.total_questions;

        const percentage = document.createElement("p");
        percentage.textContent =
          "Résultat : " + attempt.percentage + " %";

        const date = document.createElement("p");
        date.textContent = "Date : " +
          (attempt.completed_at
            ? new Date(attempt.completed_at).toLocaleString("fr-FR")
            : "Non renseignée");

        const status = document.createElement("p");
        status.textContent = Number(attempt.percentage) >= 70
          ? "Réussite"
          : "À améliorer";

        card.append(title, score, percentage, date, status);
        content.appendChild(card);
      });

      content.hidden = false;
    } catch (error) {
      console.error("Historique JAMBARE :", error);
      showMessage("Impossible de charger l'historique : " + error.message);
    }
  }

  async function openEvaluations() {
    if (!currentUser) {
      showMessage("Connecte-toi pour accéder aux évaluations.");
      return;
    }

    showMessage("Chargement des examens...");

    try {
      const { data: exams, error } = await client()
        .from("assessments")
        .select("id,title,description,duration_minutes")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      content.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = "Évaluations JAMBARE";

      content.append(
        heading,
        backButton(),
        makeButton("📊 Mon historique", openHistory)
      );

      if (!exams || exams.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Aucun examen publié pour le moment.";
        content.appendChild(p);
        content.hidden = false;
        return;
      }

      exams.forEach(exam => {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;padding:16px;margin:14px 0;border-radius:12px;";

        const title = document.createElement("h3");
        title.textContent = exam.title;

        const description = document.createElement("p");
        description.textContent = exam.description || "Évaluation de connaissances.";

        const duration = document.createElement("p");
        duration.textContent =
          "Durée : " + (exam.duration_minutes || "Non précisée") + " minute(s)";

        const start = makeButton("Commencer l'examen", () => startExam(exam));

        card.append(title, description, duration, start);
        content.appendChild(card);
      });

      content.hidden = false;
    } catch (error) {
      console.error(error);
      showMessage("Impossible de charger les examens : " + error.message);
    }
  }

  async function startExam(exam) {
    showMessage("Chargement des questions...");

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

      renderExam(exam, questions);
    } catch (error) {
      console.error(error);
      showMessage("Erreur lors du chargement des questions : " + error.message);
    }
  }

  function renderExam(exam, questions) {
    content.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = exam.title;
    content.append(heading, backButton());

    const info = document.createElement("p");
    info.textContent = questions.length + " question(s)";
    content.appendChild(info);

    const form = document.createElement("form");

    questions.forEach((question, index) => {
      const fieldset = document.createElement("fieldset");
      fieldset.style.cssText =
        "border:1px solid #ddd;border-radius:10px;padding:14px;margin:16px 0;";

      const legend = document.createElement("legend");
      legend.textContent = (index + 1) + ". " + question.prompt;
      fieldset.appendChild(legend);

      let options = question.options;
      if (typeof options === "string") {
        try {
          options = JSON.parse(options);
        } catch {
          options = [];
        }
      }

      if (!Array.isArray(options)) options = [];

      options.forEach((option, optionIndex) => {
        const label = document.createElement("label");
        label.style.cssText =
          "display:block;padding:9px 4px;cursor:pointer;";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = question.id;
        radio.value = String(optionIndex);
        radio.required = true;

        label.append(radio, document.createTextNode(" " + String(option)));
        fieldset.appendChild(label);
      });

      form.appendChild(fieldset);
    });

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Soumettre mes réponses";
    form.appendChild(submit);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const answers = {};

      for (const question of questions) {
        const selected = form.querySelector(
          'input[name="' + question.id + '"]:checked'
        );

        if (!selected) {
          showMessage("Réponds à toutes les questions avant de soumettre.");
          return;
        }

        answers[question.id] = Number(selected.value);
      }

      submit.disabled = true;
      submit.textContent = "Correction en cours...";

      try {
        const { data, error } = await client().rpc("grade_assessment", {
          p_assessment_id: exam.id,
          p_answers: answers
        });

        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;

        if (!result) {
          throw new Error("Aucun résultat reçu.");
        }

        showResults(result, questions);
      } catch (error) {
        console.error(error);
        submit.disabled = false;
        submit.textContent = "Soumettre mes réponses";
        alert("Impossible de corriger l'examen : " + error.message);
      }
    });

    content.appendChild(form);
    content.hidden = false;
  }

  function showResults(result, questions) {
    content.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Résultat de ton examen";
    content.appendChild(heading);

    const score = document.createElement("h3");
    score.textContent =
      "Score : " + result.score + " / " + result.total_questions;
    content.appendChild(score);

    const percentage = Math.round(
      (result.score / result.total_questions) * 100
    );

    const percent = document.createElement("p");
    percent.textContent = "Résultat : " + percentage + " %";
    content.appendChild(percent);

    const status = document.createElement("p");
    status.textContent = percentage >= 70
      ? "Félicitations ! Seuil de réussite atteint."
      : "Continue tes révisions et réessaie.";
    content.appendChild(status);

    (result.results || []).forEach((item, index) => {
      const question = questions.find(q => q.id === item.question_id);

      const card = document.createElement("article");
      card.style.cssText =
        "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

      const title = document.createElement("h4");
      title.textContent = (index + 1) + ". " +
        (question ? question.prompt : "Question");

      const answer = document.createElement("p");
      answer.textContent = item.is_correct
        ? "Bonne réponse"
        : "Réponse incorrecte";

      const correct = document.createElement("p");
      let options = question ? question.options : [];

      if (typeof options === "string") {
        try {
          options = JSON.parse(options);
        } catch {
          options = [];
        }
      }

      if (!Array.isArray(options)) options = [];

      correct.textContent =
        "Bonne réponse : " +
        String(options[item.correct_index] ?? item.correct_index);

      const explanation = document.createElement("p");
      explanation.textContent =
        item.explanation || "Aucune explication disponible.";

      card.append(title, answer, correct, explanation);
      content.appendChild(card);
    });

    content.append(
      makeButton("Retour aux examens", openEvaluations),
      makeButton("📊 Mon historique", openHistory)
    );

    content.hidden = false;
  }

  function openOtherSpace(name) {
    if (!currentUser) {
      showMessage("Connecte-toi pour accéder à cet espace.");
      return;
    }

    if (name === "Bibliothèque") {
      showMessage("L'espace Bibliothèque sera activé dans la prochaine étape.");
      return;
    }

    if (name === "Administration") {
      if (currentRole !== "owner" && currentRole !== "admin") {
        showMessage("Accès réservé au propriétaire et aux administrateurs.");
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

  modules.addEventListener("click", event => {
    const card = event.target.closest(".module");
    if (!card) return;

    const heading = card.querySelector("h3");
    if (!heading) return;

    const name = heading.textContent.trim();

    if (name === "Formations") openFormations();
    else if (name === "Évaluations") openEvaluations();
    else openOtherSpace(name);
  });

  if (startButton) {
    startButton.addEventListener("click", () => {
      modules.scrollIntoView({ behavior: "smooth" });
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
      return;
    }

    currentRole = data?.role || null;
  }

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
