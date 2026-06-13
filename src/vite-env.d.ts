/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEBUG_PANEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
