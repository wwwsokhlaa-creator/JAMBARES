
const startButton = document.getElementById("startButton");
const modules = document.getElementById("modules");

startButton.addEventListener("click", () => {
  modules.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// Données pédagogiques initiales de JAMBARE
const jambareData = {
  name: "JAMBARE",
  version: "1.0.0",
  modules: [
    {
      id: 1,
      title: "Connaissance des Forces armées",
      description: "Histoire, organisation, traditions et institutions."
    },
    {
      id: 2,
      title: "Règlements militaires",
      description: "Discipline, droits, devoirs et textes de référence."
    },
    {
      id: 3,
      title: "Topographie",
      description: "Lecture de cartes et notions de cartographie."
    },
    {
      id: 4,
      title: "Secourisme",
      description: "Prévention et premiers secours."
    },
    {
      id: 5,
      title: "Droit international humanitaire",
      description: "Principes fondamentaux et protection des personnes."
    }
  ]
};

console.log("JAMBARE est initialisé :", jambareData);
