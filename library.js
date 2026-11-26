
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
    b.style.margin = "6px 6px 6px 0";
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

  async function getSignedUrl(db, name) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(name, 300);

    if (error) throw error;
    return data.signedUrl;
  }

  async function openDocument(db, name) {
    const area = document.getElementById("spaceContent");
    if (!area) return;

    try {
      area.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = "📖 Consultation : " + name;

      const close = button("← Fermer le document", () => {
        area.replaceChildren();
        openLibrary();
      });

      const status = document.createElement("p");
      status.textContent = "Chargement du document...";

      const viewer = document.createElement("iframe");
      viewer.title = "Lecteur de document JAMBARE";
      viewer.style.cssText =
        "width:100%;height:75vh;border:1px solid #ddd;border-radius:10px;background:white;";

      area.append(heading, close, status, viewer);
      area.hidden = false;

      const url = await getSignedUrl(db, name);

      viewer.src = url + "#toolbar=1&navpanes=1&scrollbar=1";

      status.textContent = "Document prêt à consulter.";

    } catch (error) {
      message(
        area,
        "Impossible d'afficher le document : " + error.message
      );
    }
  }

  async function openLibrary() {
    const db = client();
    const area = getContent();

    if (!db || !area) return;

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) {
      message(area, "Erreur : " + sessionError.message);
      return;
    }

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
      fileInput.accept =
        ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

      const uploadButton = button(
        "Téléverser le document",
        async () => {
          const file = fileInput.files[0];

          if (!file) {
            alert("Choisis d'abord un document.");
            return;
          }

          uploadButton.disabled = true;
          uploadButton.textContent = "Envoi en cours...";

          try {
            const safeName = file.name.replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );

            const path = Date.now() + "-" + safeName;

            const { error } = await db.storage
              .from(BUCKET)
              .upload(path, file, { upsert: false });

            if (error) throw error;

            alert("Document ajouté avec succès.");
            fileInput.value = "";
            await loadFiles();

          } catch (error) {
            alert("Erreur : " + error.message);
          } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = "Téléverser le document";
          }
        }
      );

      area.append(uploadTitle, fileInput, uploadButton);
    }

    const listTitle = document.createElement("h3");
    listTitle.textContent = "Documents disponibles";

    const fileList = document.createElement("div");

    area.append(listTitle, fileList);

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
        fileList.textContent =
          "Aucun document disponible pour le moment.";
      }

      documents.forEach(file => {
        const card = document.createElement("article");

        card.style.cssText =
          "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

        const name = document.createElement("p");
        name.textContent = "📄 " + file.name;

        // CONSULTER DIRECTEMENT SUR JAMBARE
        const consult = button("Consulter", () => {
          openDocument(db, file.name);
        });

        // TÉLÉCHARGER SUR LE TÉLÉPHONE
        const download = button("Télécharger", async () => {
          download.disabled = true;
          download.textContent = "Téléchargement...";

          try {
            const { data: blob, error } = await db.storage
              .from(BUCKET)
              .download(file.name);

            if (error) throw error;

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = file.name;
            link.style.display = "none";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
              URL.revokeObjectURL(objectUrl);
            }, 120000);

          } catch (error) {
            alert("Échec du téléchargement : " + error.message);
          } finally {
            download.disabled = false;
            download.textContent = "Télécharger";
          }
        });

        card.append(name, consult, download);

        if (isAdmin) {
          const remove = button(
            "Supprimer du serveur",
            async () => {
              if (!confirm(
                "Supprimer définitivement ce document de la bibliothèque ?"
              )) return;

              const { error } = await db.storage
                .from(BUCKET)
                .remove([file.name]);

              if (error) {
                alert("Suppression impossible : " + error.message);
              } else {
                await loadFiles();
              }
            }
          );

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

      if (
        !title ||
        title.textContent.trim() !== "Bibliothèque"
      ) return;

      event.stopImmediatePropagation();
      openLibrary();
    }, true);
  }

  activateLibrary();
})();
