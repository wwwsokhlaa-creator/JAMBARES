
(() => {
  const BUCKET = "jambare-library";
  const client = () => window.supabaseClient;

  function getContent() {
    let area = document.getElementById("spaceContent");

    if (!area) {
      const modules = document.getElementById("modules");
      if (!modules) return null;

      area = document.createElement("section");
      area.id = "spaceContent";
      area.style.cssText =
        "background:white;padding:18px;margin-top:18px;border-radius:14px;";
      modules.appendChild(area);
    }

    return area;
  }

  function button(label, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", action);
    return b;
  }

  function message(area, text) {
    area.replaceChildren();
    const p = document.createElement("p");
    p.textContent = text;
    area.appendChild(p);
    area.hidden = false;
  }

  async function openLibrary() {
    const db = client();
    const area = getContent();

    if (!db || !area) return;

    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      message(area, "Connecte-toi pour accéder à la bibliothèque.");
      return;
    }

    message(area, "Chargement de la bibliothèque...");

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      message(area, "Impossible de vérifier ton profil.");
      return;
    }

    const isAdmin = ["owner", "admin"].includes(profile.role);

    area.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "📚 Bibliothèque JAMBARE";

    const back = button("← Retour aux espaces", () => {
      area.hidden = true;
    });

    area.append(heading, back);

    if (isAdmin) {
      const uploadTitle = document.createElement("h3");
      uploadTitle.textContent = "Ajouter un document";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

      const uploadButton = button("Téléverser le document", async () => {
        const file = fileInput.files[0];

        if (!file) {
          alert("Choisis d'abord un document.");
          return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = "Envoi en cours...";

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = Date.now() + "-" + safeName;

        const { error } = await db.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (error) {
          alert("Erreur : " + error.message);
        } else {
          alert("Document ajouté avec succès.");
          await loadFiles();
        }

        uploadButton.disabled = false;
        uploadButton.textContent = "Téléverser le document";
      });

      area.append(uploadTitle, fileInput, uploadButton);
    }

    const listTitle = document.createElement("h3");
    listTitle.textContent = "Documents disponibles";
    area.appendChild(listTitle);

    const fileList = document.createElement("div");
    area.appendChild(fileList);

    async function loadFiles() {
      fileList.textContent = "Chargement des documents...";

      const { data: files, error } = await db.storage
        .from(BUCKET)
        .list("", {
          limit: 100,
          sortBy: { column: "name", order: "asc" }
        });

      fileList.replaceChildren();

      if (error) {
        fileList.textContent = "Erreur : " + error.message;
        return;
      }

      const documents = (files || []).filter(file => file.id);

      if (documents.length === 0) {
        fileList.textContent = "Aucun document disponible pour le moment.";
        return;
      }

      documents.forEach(file => {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

        const name = document.createElement("p");
        name.textContent = "📄 " + file.name;

        const download = button("Télécharger", async () => {
          const { data, error } = await db.storage
            .from(BUCKET)
            .createSignedUrl(file.name, 60);

          if (error) {
            alert("Téléchargement impossible : " + error.message);
            return;
          }

          const link = document.createElement("a");
          link.href = data.signedUrl;
          link.download = file.name;
          link.target = "_blank";
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
        });

        card.append(name, download);

        if (isAdmin) {
          const remove = button("Supprimer", async () => {
            if (!confirm("Supprimer ce document ?")) return;

            const { error } = await db.storage
              .from(BUCKET)
              .remove([file.name]);

            if (error) {
              alert("Suppression impossible : " + error.message);
            } else {
              await loadFiles();
            }
          });

          card.appendChild(remove);
        }

        fileList.appendChild(card);
      });
    }

    await loadFiles();
    area.hidden = false;
  }

  function activateLibrary() {
    const modules = document.getElementById("modules");
    if (!modules) return;

    modules.addEventListener("click", event => {
      const card = event.target.closest(".module");
      if (!card) return;

      const title = card.querySelector("h3");
      if (!title || title.textContent.trim() !== "Bibliothèque") return;

      event.stopImmediatePropagation();
      openLibrary();
    }, true);
  }

  activateLibrary();
})();
