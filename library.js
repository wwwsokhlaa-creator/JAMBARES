
(() => {
  "use strict";

  const BUCKET = "jambare-library";
  const DB_NAME = "JAMBARE_OFFLINE";
  const STORE_NAME = "documents";

  const client = () => window.supabaseClient;

  let currentObjectUrl = null;

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

  function openOfflineDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Le stockage hors connexion n'est pas disponible."));
        return;
      }

      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: "name"
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveOffline(name, blob) {
    const db = await openOfflineDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");

      transaction.objectStore(STORE_NAME).put({
        name,
        blob,
        savedAt: new Date().toISOString()
      });

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };

      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("Enregistrement interrompu."));
      };
    });
  }

  async function getOffline(name) {
    const db = await openOfflineDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(name);

      request.onsuccess = () => {
        const result = request.result || null;
        db.close();
        resolve(result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async function getAllOffline() {
    const db = await openOfflineDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => {
        const result = request.result || [];
        db.close();
        resolve(result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async function removeOffline(name) {
    const db = await openOfflineDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(name);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function getMimeType(name) {
    const extension = name.split(".").pop().toLowerCase();

    const types = {
      pdf: "application/pdf",
      txt: "text/plain",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };

    return types[extension] || "application/octet-stream";
  }

  function showDocument(area, name, url, isBlob = false) {
    const old = document.getElementById("jambare-document-preview");

    if (old) old.remove();

    if (currentObjectUrl && currentObjectUrl !== url) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    if (isBlob) {
      currentObjectUrl = url;
    }

    const preview = document.createElement("section");
    preview.id = "jambare-document-preview";
    preview.style.cssText =
      "margin-top:18px;padding:16px;border:1px solid #ddd;border-radius:12px;background:#fff;";

    const heading = document.createElement("h3");
    heading.textContent = "Consultation : " + name;

    const info = document.createElement("p");
    info.textContent = isBlob
      ? "Copie enregistrée sur ce téléphone. Tu peux l'ouvrir sans Internet."
      : "Document disponible sur le serveur JAMBARE.";

    const openLink = document.createElement("a");
    openLink.href = url;
    openLink.target = "_blank";
    openLink.rel = "noopener";
    openLink.textContent = "Ouvrir le document";
    openLink.style.cssText =
      "display:inline-block;background:#234b36;color:white;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 8px 8px 0;";

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = name;
    downloadLink.textContent = "Télécharger une copie";
    downloadLink.style.cssText =
      "display:inline-block;background:#234b36;color:white;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 8px 8px 0;";

    const close = button("Fermer le document", () => {
      preview.remove();

      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
    });

    preview.append(heading, info, openLink, downloadLink, close);
    area.appendChild(preview);

    preview.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function getSignedUrl(db, name) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(name, 300);

    if (error) throw error;

    return data.signedUrl;
  }

  async function openDocument(db, area, name) {
    try {
      const saved = await getOffline(name).catch(() => null);

      if (!navigator.onLine) {
        if (!saved) {
          alert("Ce document n'est pas enregistré sur ce téléphone.");
          return;
        }

        const url = URL.createObjectURL(saved.blob);
        showDocument(area, name, url, true);
        return;
      }

      try {
        const url = await getSignedUrl(db, name);
        showDocument(area, name, url, false);
      } catch (error) {
        if (saved) {
          const url = URL.createObjectURL(saved.blob);
          showDocument(area, name, url, true);
        } else {
          throw error;
        }
      }
    } catch (error) {
      alert("Impossible d'ouvrir le document : " + error.message);
    }
  }

  async function openLibrary() {
    const db = client();
    const area = getContent();

    if (!db || !area) return;

    try {
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      if (sessionError) throw sessionError;

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

        fileInput.style.display = "block";
        fileInput.style.margin = "12px 0";

        const uploadButton = button("Téléverser le document", async () => {
          const file = fileInput.files?.[0];

          if (!file) {
            alert("Choisis d'abord un document.");
            return;
          }

          uploadButton.disabled = true;
          uploadButton.textContent = "Envoi en cours...";

          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = Date.now() + "-" + safeName;

            const { error } = await db.storage
              .from(BUCKET)
              .upload(path, file, {
                upsert: false,
                contentType: file.type || getMimeType(file.name)
              });

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
        });

        area.append(uploadTitle, fileInput, uploadButton);
      }

      const listTitle = document.createElement("h3");
      listTitle.textContent = "Documents disponibles";
      area.appendChild(listTitle);

      const fileList = document.createElement("div");
      area.appendChild(fileList);

      const offlineTitle = document.createElement("h3");
      offlineTitle.textContent = "📥 Mes documents hors connexion";
      area.appendChild(offlineTitle);

      const offlineList = document.createElement("div");
      area.appendChild(offlineList);

      async function loadOfflineFiles() {
        offlineList.replaceChildren();

        try {
          const savedFiles = await getAllOffline();

          if (savedFiles.length === 0) {
            offlineList.textContent =
              "Aucun document enregistré hors connexion sur ce téléphone.";
            return;
          }

          savedFiles.forEach(saved => {
            const card = document.createElement("article");
            card.style.cssText =
              "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

            const name = document.createElement("p");
            name.textContent = "📄 " + saved.name;

            const open = button("Consulter hors connexion", () => {
              const url = URL.createObjectURL(saved.blob);
              showDocument(area, saved.name, url, true);
            });

            const remove = button("Retirer du téléphone", async () => {
              if (!confirm("Retirer cette copie de ce téléphone ?")) return;

              try {
                await removeOffline(saved.name);
                await loadOfflineFiles();
              } catch (error) {
                alert("Suppression impossible : " + error.message);
              }
            });

            card.append(name, open, remove);
            offlineList.appendChild(card);
          });
        } catch (error) {
          offlineList.textContent =
            "Stockage hors connexion indisponible : " + error.message;
        }
      }

      async function loadFiles() {
        fileList.textContent = "Chargement des documents...";

        const { data: files, error } = await db.storage
          .from(BUCKET)
          .list("", {
            limit: 100,
            sortBy: {
              column: "name",
              order: "asc"
            }
          });

        fileList.replaceChildren();

        if (error) {
          fileList.textContent = navigator.onLine
            ? "Erreur : " + error.message
            : "Connexion indisponible. Consulte les copies enregistrées plus bas.";

          await loadOfflineFiles();
          return;
        }

        const documents = (files || []).filter(file => file.id);

        if (documents.length === 0) {
          fileList.textContent =
            "Aucun document disponible pour le moment.";
        }

        for (const file of documents) {
          const card = document.createElement("article");
          card.style.cssText =
            "border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;";

          const name = document.createElement("p");
          name.textContent = "📄 " + file.name;

          const open = button("Consulter", () =>
            openDocument(db, area, file.name)
          );

          const save = button("Enregistrer hors connexion", async () => {
            save.disabled = true;
            save.textContent = "Enregistrement...";

            try {
              const url = await getSignedUrl(db, file.name);
              const response = await fetch(url);

              if (!response.ok) {
                throw new Error("Téléchargement du document impossible.");
              }

              const downloadedBlob = await response.blob();

              const blob = new Blob(
                [downloadedBlob],
                { type: getMimeType(file.name) }
              );

              await saveOffline(file.name, blob);

              alert(
                "Document enregistré sur ce téléphone. Tu pourras le consulter sans Internet."
              );

              await loadOfflineFiles();
            } catch (error) {
              alert("Erreur : " + error.message);
            } finally {
              save.disabled = false;
              save.textContent = "Enregistrer hors connexion";
            }
          });

          const download = button("Télécharger", async () => {
            try {
              const url = await getSignedUrl(db, file.name);

              const link = document.createElement("a");
              link.href = url;
              link.download = file.name;
              link.target = "_blank";
              link.rel = "noopener";

              document.body.appendChild(link);
              link.click();
              link.remove();
            } catch (error) {
              alert("Téléchargement impossible : " + error.message);
            }
          });

          card.append(name, open, save, download);

          if (isAdmin) {
            const remove = button("Supprimer du serveur", async () => {
              if (!confirm(
                "Supprimer définitivement ce document de la bibliothèque ?"
              )) {
                return;
              }

              try {
                const { error } = await db.storage
                  .from(BUCKET)
                  .remove([file.name]);

                if (error) throw error;

                alert("Document supprimé du serveur.");
                await loadFiles();
              } catch (error) {
                alert("Suppression impossible : " + error.message);
              }
            });

            card.appendChild(remove);
          }

          fileList.appendChild(card);
        }

        await loadOfflineFiles();
      }

      await loadFiles();
      area.hidden = false;
    } catch (error) {
      console.error("Bibliothèque JAMBARE :", error);
      message(area, "Erreur : " + error.message);
    }
  }

  function activateLibrary() {
    const modules = document.getElementById("modules");
    if (!modules) return;

    modules.addEventListener("click", event => {
      const card = event.target.closest(".module");
      if (!card) return;

      const title = card.querySelector("h3");

      if (!title || title.textContent.trim() !== "Bibliothèque") {
        return;
      }

      event.stopImmediatePropagation();
      openLibrary();
    }, true);
  }

  activateLibrary();
})();
