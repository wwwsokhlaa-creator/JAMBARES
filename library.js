
(() => {
  const BUCKET = "jambare-library";
  const DB_NAME = "JAMBARE_OFFLINE";
  const STORE = "documents";
  const client = () => window.supabaseClient;

  let currentArea = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "path" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function localGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function localGet(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly")
        .objectStore(STORE).get(path);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function localSave(document) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(document);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function localDelete(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

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

  async function getRemoteFiles(db) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list("", {
        limit: 100,
        sortBy: { column: "name", order: "asc" }
      });

    if (error) throw error;
    return (data || []).filter(file => file.id);
  }

  async function fetchDocument(db, path) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(path, 300);

    if (error) throw error;

    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      throw new Error("Téléchargement impossible.");
    }

    return await response.blob();
  }

  async function saveForOffline(db, file, actionButton) {
    actionButton.disabled = true;
    actionButton.textContent = "Enregistrement...";

    try {
      const blob = await fetchDocument(db, file.name);

      await localSave({
        path: file.name,
        name: file.name,
        updatedAt: file.updated_at || "",
        blob,
        savedAt: new Date().toISOString()
      });

      actionButton.textContent = "Disponible hors connexion";
      alert("Document enregistré sur ce téléphone.");
    } catch (error) {
      alert("Enregistrement impossible : " + error.message);
      actionButton.textContent = "Enregistrer hors connexion";
    } finally {
      actionButton.disabled = false;
    }
  }

  async function openOffline(path) {
    const document = await localGet(path);

    if (!document) {
      alert("Ce document n'est pas enregistré sur ce téléphone.");
      return;
    }

    const url = URL.createObjectURL(document.blob);
    const tab = window.open(url, "_blank");

    if (!tab) {
      const link = document.createElement("a");
      link.href = url;
      link.download = document.name;
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function syncDocuments(db, area) {
    const status = document.getElementById("library-sync-status");
    if (status) status.textContent = "Synchronisation en cours...";

    try {
      const remoteFiles = await getRemoteFiles(db);
      const localFiles = await localGetAll();
      const remoteNames = new Set(remoteFiles.map(file => file.name));

      // Retirer les copies locales des documents supprimés du serveur.
      for (const local of localFiles) {
        if (!remoteNames.has(local.path)) {
          await localDelete(local.path);
        }
      }

      // Actualiser uniquement les documents déjà enregistrés localement.
      for (const file of remoteFiles) {
        const local = await localGet(file.name);
        if (!local) continue;

        const remoteDate = file.updated_at || "";

        if (remoteDate && remoteDate !== local.updatedAt) {
          const blob = await fetchDocument(db, file.name);

          await localSave({
            path: file.name,
            name: file.name,
            updatedAt: remoteDate,
            blob,
            savedAt: new Date().toISOString()
          });
        }
      }

      if (status) {
        status.textContent = "Synchronisation terminée.";
      }

      await loadFiles(db, area);
    } catch (error) {
      if (status) {
        status.textContent =
          "Synchronisation impossible : " + error.message;
      }
    }
  }

  async function loadFiles(db, area) {
    const fileList = document.getElementById("library-files");
    if (!fileList) return;

    fileList.textContent = "Chargement des documents...";

    let remoteFiles = [];

    try {
      remoteFiles = await getRemoteFiles(db);
    } catch (error) {
      remoteFiles = null;
    }

    const localFiles = await localGetAll();
    fileList.replaceChildren();

    if (remoteFiles === null) {
      const offlineTitle = document.createElement("h3");
      offlineTitle.textContent = "Documents enregistrés sur ce téléphone";
      fileList.appendChild(offlineTitle);

      if (localFiles.length === 0) {
        fileList.textContent =
          "Aucun document enregistré hors connexion.";
        return;
      }

      localFiles.forEach(file => {
        const card = document.createElement("article");
        card.style.cssText =
          "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

        const name = document.createElement("p");
        name.textContent = "📄 " + file.name;

        card.append(
          name,
          button("Ouvrir hors connexion", () => openOffline(file.path))
        );

        fileList.appendChild(card);
      });

      return;
    }

    if (remoteFiles.length === 0) {
      fileList.textContent = "Aucun document disponible pour le moment.";
      return;
    }

    for (const file of remoteFiles) {
      const card = document.createElement("article");
      card.style.cssText =
        "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

      const name = document.createElement("p");
      name.textContent = "📄 " + file.name;

      const local = await localGet(file.name);

      card.appendChild(name);

      card.appendChild(button("Télécharger", async () => {
        try {
          const blob = await fetchDocument(db, file.name);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
          alert("Téléchargement impossible : " + error.message);
        }
      }));

      if (local) {
        card.appendChild(button(
          "Ouvrir hors connexion",
          () => openOffline(file.name)
        ));
      } else {
        const saveButton = button(
          "Enregistrer hors connexion",
          () => saveForOffline(db, file, saveButton)
        );
        card.appendChild(saveButton);
      }

      const profileRole = area.dataset.libraryRole;

      if (["owner", "admin"].includes(profileRole)) {
        card.appendChild(button("Supprimer", async () => {
          if (!confirm("Supprimer ce document définitivement ?")) return;

          const { error } = await db.storage
            .from(BUCKET)
            .remove([file.name]);

          if (error) {
            alert("Suppression impossible : " + error.message);
            return;
          }

          await localDelete(file.name);
          await loadFiles(db, area);
        }));
      }

      fileList.appendChild(card);
    }
  }

  async function openLibrary() {
    const db = client();
    const area = getContent();

    if (!db || !area) return;

    currentArea = area;

    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      message(area, "Connecte-toi pour accéder à la bibliothèque.");
      return;
    }

    message(area, "Chargement de la bibliothèque...");

    const { data: profile, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      message(area, "Impossible de vérifier ton profil.");
      return;
    }

    const isAdmin = ["owner", "admin"].includes(profile.role);

    area.dataset.libraryRole = profile.role;
    area.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "📚 Bibliothèque JAMBARE";

    const back = button("← Retour aux espaces", () => {
      area.hidden = true;
    });

    area.append(heading, back);

    const syncStatus = document.createElement("p");
    syncStatus.id = "library-sync-status";
    syncStatus.textContent = navigator.onLine
      ? "Connexion disponible."
      : "Mode hors connexion.";
    area.appendChild(syncStatus);

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
          fileInput.value = "";
          await loadFiles(db, area);
        }

        uploadButton.disabled = false;
        uploadButton.textContent = "Téléverser le document";
      });

      area.append(uploadTitle, fileInput, uploadButton);
    }

    area.appendChild(button(
      "Synchroniser les documents",
      () => syncDocuments(db, area)
    ));

    const listTitle = document.createElement("h3");
    listTitle.textContent = "Documents disponibles";
    area.appendChild(listTitle);

    const fileList = document.createElement("div");
    fileList.id = "library-files";
    area.appendChild(fileList);

    await loadFiles(db, area);
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

  window.addEventListener("online", () => {
    if (currentArea && !currentArea.hidden && client()) {
      syncDocuments(client(), currentArea);
    }
  });

  activateLibrary();
})();
