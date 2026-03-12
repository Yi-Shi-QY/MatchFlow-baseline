/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET?: string;
  readonly VITE_MATCHFLOW_LOCAL_TEST_SERVER_URL?: string;
  readonly VITE_MATCHFLOW_LOCAL_TEST_SERVER_ANDROID_URL?: string;
  readonly VITE_MATCHFLOW_LOCAL_TEST_SERVER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
