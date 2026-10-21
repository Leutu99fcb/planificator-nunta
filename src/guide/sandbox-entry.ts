import { GUIDE_SCENE, installSandboxStorage } from "./runtime";

// Importat primul în main.tsx: în modul ghid, memoria izolată trebuie să fie activă înainte
// ca alte module (tema, login-ul) să citească din localStorage / sessionStorage.
if (GUIDE_SCENE) {
  installSandboxStorage();
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/${GUIDE_SCENE}`);
}
