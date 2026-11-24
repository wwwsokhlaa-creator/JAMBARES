
(() => {
  let loading = false;
  let currentUser = null;
  let editingCourseId = null;

  const client = () => window.supabaseClient;

  function status(message) {
    const el = document.getElementById("jambare-admin-status");
    if (el) el.textContent = message;
  }

  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  async function initJambareAdmin(user) {
    if (loading) return;
    loading = true;

    try {
      const db = client();
      if (!db) throw new Error("Connexion Supabase introuvable.");

      if (!user) {
        const { data, error } = await db.auth.getUser();
        if (error) throw error;
        user = data.user;
      }

      if (!user) throw new Error("Aucun utilisateur connecté.");

      const { data: profile, error } = await db
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (profile?.role !== "owner") {
        throw new Error("Accès réservé au propriétaire.");
      }

      currentUser = user;

      let panel = document.getElementById("jambare-admin");

      if (!panel) {
        panel = document.createElement("section");
        panel.id = "jambare-admin";
        const modules = document.getElementById("modules");

        if (modules) modules.after(panel);
        else document.body.appendChild(panel);
      }

      panel.innerHTML = `
        <div style="background:#14251b;color:white;padding:20px;margin:20px 0;border-radius:14px;">
          <h2>ESPACE PROPRIÉTAIRE JAMBARE</h2>
          <p id="jambare-owner-name"></p>
          <p id="jambare-admin-status">Chargement...</p>

          <hr>
          <h3>Gestion des militaires</h3>
          <button type="button" id="refresh-users">Actualiser les comptes</button>
          <div id="admin-users">Chargement...</div>

          <hr>
          <h3>Gestion des formations</h3>

          <form id="course-form" style="background:#fff;color:#222;padding:15px;border-radius:10px;">
            <h3 id="course-form-title">Ajouter une formation</h3>

            <label for="course-title">Titre de la formation *</label>
            <input id="course-title" type="text" required maxlength="200"
              placeholder="Ex. Règlement militaire"
              style="display:block;width:100%;padding:12px;margin:7px 0 14px;box-sizing:border-box;">

            <label for="course-description">Description</label>
            <textarea id="course-description" rows="4"
              placeholder="Présentez le contenu de la formation"
              style="display:block;width:100%;padding:12px;margin:7px 0 14px;box-sizing:border-box;"></textarea>

            <label for="course-category">Catégorie</label>
            <input id="course-category" type="text" maxlength="100"
              placeholder="Ex. Discipline, histoire, réglementation"
              style="display:block;width:100%;padding:12px;margin:7px 0 14px;box-sizing:border-box;">

            <label for="course-level">Niveau</label>
            <select id="course-level"
              style="display:block;width:100%;padding:12px;margin:7px 0 14px;box-sizing:border-box;">
              <option value="1">Niveau 1 - Débutant</option>
              <option value="2">Niveau 2 - Élémentaire</option>
              <option value="3">Niveau 3 - Intermédiaire</option>
              <option value="4">Niveau 4 - Avancé</option>
              <option value="5">Niveau 5 - Perfectionnement</option>
            </select>

            <label style="display:flex;gap:9px;align-items:center;margin:12px 0;">
              <input id="course-published" type="checkbox">
              Publier immédiatement cette formation
            </label>

            <button type="submit" id="save-course">Enregistrer la formation</button>
            <button type="button" id="cancel-course" hidden>Annuler la modification</button>
            <p id="course-message" role="status"></p>
          </form>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin:15px 0;">
            <button type="button" id="refresh-courses">Actualiser les formations</button>
          </div>

          <div id="admin-courses">Chargement des formations...</div>
        </div>
      `;

      document.getElementById("jambare-owner-name").textContent =
        "Propriétaire : " + (profile.full_name || "JAMBARE");

      document.getElementById("refresh-users").onclick = () =>
        loadUsers(db);

      document.getElementById("refresh-courses").onclick = () =>
        loadCourses(db);

      document.getElementById("course-form").onsubmit = event =>
        saveCourse(event, db);

      document.getElementById("cancel-course").onclick = resetCourseForm;

      await loadUsers(db);
      await loadCourses(db);

      status("Espace propriétaire chargé.");
    } catch (error) {
      console.error("JAMBARE ADMIN :", error);
      status("Erreur : " + error.message);
    } finally {
      loading = false;
    }
  }

  async function loadUsers(db) {
    const area = document.getElementById("admin-users");
    if (!area) return;

    area.textContent = "Chargement des comptes...";

    const { data, error } = await db
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
      const card = make("div");
      card.style.cssText =
        "background:white;color:#222;padding:13px;margin:10px 0;border-radius:9px;";

      card.appendChild(make("strong", user.full_name || "Nom non renseigné"));
      card.appendChild(make("p",
        "Nom de guerre : " + (user.nom_guerre || "Non renseigné") +
        " | Rôle : " + user.role
      ));

      if (user.role !== "owner") {
        const select = document.createElement("select");
        select.style.cssText = "padding:9px;max-width:100%;";

        [
          ["pending", "En attente"],
          ["military", "Militaire autorisé"],
          ["trainer", "Formateur"],
          ["admin", "Administrateur"]
        ].forEach(([value, label]) => {
          const option = make("option", label);
          option.value = value;
          select.appendChild(option);
        });

        select.value = ["pending", "military", "trainer", "admin"]
          .includes(user.role) ? user.role : "pending";

        const button = make("button", "Enregistrer le rôle");
        button.type = "button";
        button.style.margin = "8px";

        button.onclick = async () => {
          button.disabled = true;

          const { error } = await db.rpc("set_jambare_role", {
            p_user_id: user.id,
            p_new_role: select.value
          });

          button.disabled = false;

          if (error) {
            alert("Modification impossible : " + error.message);
          } else {
            alert("Rôle mis à jour.");
            await loadUsers(db);
          }
        };

        card.append(select, button);
      }

      area.appendChild(card);
    });
  }

  async function loadCourses(db) {
    const area = document.getElementById("admin-courses");
    if (!area) return;

    area.textContent = "Chargement des formations...";

    const { data, error } = await db
      .from("courses")
      .select("id, title, description, category, level, is_published, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      area.textContent = "Erreur : " + error.message;
      return;
    }

    area.innerHTML = "";

    if (!data || data.length === 0) {
      area.textContent = "Aucune formation enregistrée pour le moment.";
      return;
    }

    data.forEach(course => {
      const card = make("article");
      card.style.cssText =
        "background:white;color:#222;padding:15px;margin:12px 0;border-radius:10px;";

      card.appendChild(make("h3", course.title));
      card.appendChild(make("p", course.description || "Aucune description."));
      card.appendChild(make("p",
        "Catégorie : " + (course.category || "Non renseignée") +
        " | Niveau : " + course.level
      ));

      const publication = make("strong",
        course.is_published ? "Publié" : "Non publié"
      );
      publication.style.color = course.is_published ? "green" : "#9a5b00";
      card.appendChild(publication);

      const actions = make("div");
      actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;";

      const edit = make("button", "Modifier");
      edit.type = "button";
      edit.onclick = () => editCourse(course);

      const toggle = make("button",
        course.is_published ? "Dépublier" : "Publier"
      );
      toggle.type = "button";
      toggle.onclick = () => toggleCourse(db, course);

      const remove = make("button", "Supprimer");
      remove.type = "button";
      remove.onclick = () => deleteCourse(db, course);

      actions.append(edit, toggle, remove);
      card.appendChild(actions);
      area.appendChild(card);
    });
  }

  async function saveCourse(event, db) {
    event.preventDefault();

    const message = document.getElementById("course-message");
    const button = document.getElementById("save-course");

    const title = document.getElementById("course-title").value.trim();
    const description = document.getElementById("course-description").value.trim();
    const category = document.getElementById("course-category").value.trim();
    const level = Number(document.getElementById("course-level").value);
    const is_published = document.getElementById("course-published").checked;

    if (!title) {
      message.textContent = "Le titre est obligatoire.";
      return;
    }

    const values = {
      title,
      description: description || null,
      category: category || null,
      level,
      is_published
    };

    button.disabled = true;
    message.textContent = "Enregistrement en cours...";

    try {
      let result;

      if (editingCourseId) {
        result = await db.from("courses")
          .update(values)
          .eq("id", editingCourseId);
      } else {
        result = await db.from("courses").insert(values);
      }

      if (result.error) throw result.error;

      message.textContent = "Formation enregistrée avec succès.";
      resetCourseForm();
      await loadCourses(db);
    } catch (error) {
      message.textContent = "Erreur : " + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function editCourse(course) {
    editingCourseId = course.id;

    document.getElementById("course-title").value = course.title || "";
    document.getElementById("course-description").value = course.description || "";
    document.getElementById("course-category").value = course.category || "";
    document.getElementById("course-level").value = String(course.level || 1);
    document.getElementById("course-published").checked = !!course.is_published;

    document.getElementById("course-form-title").textContent =
      "Modifier la formation";

    document.getElementById("save-course").textContent =
      "Enregistrer les modifications";

    document.getElementById("cancel-course").hidden = false;

    document.getElementById("course-form").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function resetCourseForm() {
    editingCourseId = null;

    const form = document.getElementById("course-form");
    if (!form) return;

    form.reset();

    document.getElementById("course-form-title").textContent =
      "Ajouter une formation";

    document.getElementById("save-course").textContent =
      "Enregistrer la formation";

    document.getElementById("cancel-course").hidden = true;
    document.getElementById("course-message").textContent = "";
  }

  async function toggleCourse(db, course) {
    const action = course.is_published ? "dépublier" : "publier";

    if (!confirm("Confirmer : " + action + " « " + course.title + " » ?")) {
      return;
    }

    const { error } = await db.from("courses")
      .update({ is_published: !course.is_published })
      .eq("id", course.id);

    if (error) {
      alert("Modification impossible : " + error.message);
      return;
    }

    await loadCourses(db);
  }

  async function deleteCourse(db, course) {
    const confirmed = confirm(
      "Supprimer définitivement la formation « " +
      course.title +
      " » ? Cette action peut être irréversible."
    );

    if (!confirmed) return;

    const { error } = await db.from("courses")
      .delete()
      .eq("id", course.id);

    if (error) {
      alert("Suppression impossible : " + error.message);
      return;
    }

    if (editingCourseId === course.id) resetCourseForm();

    alert("Formation supprimée.");
    await loadCourses(db);
  }

  window.initJambareAdmin = initJambareAdmin;

  window.addEventListener("jambare:owner-ready", () => {
    initJambareAdmin(window.JAMBARE_AUTH_USER);
  });

  if (window.JAMBARE_AUTH_USER) {
    initJambareAdmin(window.JAMBARE_AUTH_USER);
  }
})();
