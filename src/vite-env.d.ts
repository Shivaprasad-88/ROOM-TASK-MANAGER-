/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_APP_ID: string
  readonly VITE_ADMOB_UNIT_ID: string
  readonly VITE_ADSENSE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
