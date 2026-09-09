/**
 * @types/youtube déclare l'espace de noms `YT`, mais pas le point d'entrée du
 * script externe : `window.onYouTubeIframeAPIReady`, que l'API IFrame appelle
 * elle-même une fois chargée (docs/qc-lecteur.md, issue #14).
 */
export {};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}
