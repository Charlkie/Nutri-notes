import { useCallback, useEffect, useRef, useState } from "react";
import Dexie from "dexie";
import { createFullBackup, isoDate } from "./data/db";
import { parseBackup, type BackupData } from "./domain/portability";

const GOOGLE_CLIENT_ID =
  "312275672958-d8q8je5cohaa12c3oqfbln216rsu48sj.apps.googleusercontent.com";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const AUTH_KEY = "nutri-notes.google-drive.auth";
const DIRTY_KEY = "nutri-notes.google-drive.dirty";
const AUTO_BACKUP_DELAY = 8_000;
const AUTO_BACKUP_THROTTLE = 60_000;

interface StoredGoogleAuth {
  authorised: true;
  accessToken?: string;
  expiresAt?: number;
  accountName?: string;
  accountEmail?: string;
  lastBackupAt?: string;
  lastError?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): GoogleTokenClient;
  revoke(token: string, callback: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

export interface GoogleDriveBackupState {
  connected: boolean;
  needsReconnect: boolean;
  ready: boolean;
  accountName?: string;
  accountEmail?: string;
  lastBackupAt?: string;
  lastError?: string;
  busy: boolean;
}

export interface GoogleDriveBackupController extends GoogleDriveBackupState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreLatest: () => Promise<BackupData>;
}

const readAuth = (): StoredGoogleAuth | undefined => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as StoredGoogleAuth) : undefined;
  } catch {
    return undefined;
  }
};

const writeAuth = (auth: StoredGoogleAuth) =>
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));

const hasValidToken = (auth = readAuth()) =>
  Boolean(
    auth?.accessToken && (auth.expiresAt ?? 0) > Date.now() + 60_000,
  );

const publicState = (
  auth: StoredGoogleAuth | undefined,
  busy = false,
  ready = Boolean(window.google?.accounts.oauth2),
  transientError?: string,
): GoogleDriveBackupState => ({
  connected: Boolean(auth?.authorised),
  needsReconnect: Boolean(auth?.authorised && !hasValidToken(auth)),
  accountName: auth?.accountName,
  accountEmail: auth?.accountEmail,
  lastBackupAt: auth?.lastBackupAt,
  lastError: auth?.lastError ?? transientError,
  busy,
  ready,
});

let identityPromise: Promise<GoogleOAuth2> | undefined;
function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  if (window.google?.accounts.oauth2)
    return Promise.resolve(window.google.accounts.oauth2);
  if (identityPromise) return identityPromise;
  identityPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts.oauth2) resolve(window.google.accounts.oauth2);
      else reject(new Error("Google authentication did not load"));
    };
    script.onerror = () => reject(new Error("Could not load Google authentication"));
    document.head.append(script);
  });
  return identityPromise;
}

export async function googleApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body = (await response.text()).trim();
  let detail = body;
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string } | string;
      error_description?: string;
    };
    detail =
      parsed.error_description ??
      (typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message ?? parsed.error?.status) ??
      body;
  } catch {
    // Google may return a useful plain-text diagnostic.
  }
  return new Error(
    `${fallback} (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
  );
}

async function requestToken() {
  const oauth2 = await loadGoogleIdentity();
  const response = await new Promise<GoogleTokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: resolve,
      error_callback: (error) =>
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Google Drive connection was cancelled"
              : "Google Drive connection could not open",
          ),
        ),
    });
    client.requestAccessToken({ prompt: readAuth()?.authorised ? "" : "consent" });
  });
  if (!response.access_token)
    throw new Error(
      response.error_description ?? response.error ?? "Google Drive access was not granted",
    );
  const existing = readAuth();
  writeAuth({
    authorised: true,
    ...existing,
    accessToken: response.access_token,
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
    lastError: undefined,
  });
  return response.access_token;
}

function accessToken() {
  const auth = readAuth();
  if (!auth?.authorised) throw new Error("Google Drive is not connected");
  if (!hasValidToken(auth))
    throw new Error("Reconnect Google Drive to resume automatic backups");
  return auth.accessToken!;
}

async function fetchAccount() {
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",
    { headers: { Authorization: `Bearer ${accessToken()}` } },
  );
  if (!response.ok)
    throw await googleApiError(response, "Could not read Google Drive account");
  const result = (await response.json()) as {
    user?: { displayName?: string; emailAddress?: string };
  };
  const auth = readAuth();
  if (auth)
    writeAuth({
      ...auth,
      accountName: result.user?.displayName,
      accountEmail: result.user?.emailAddress,
    });
}

interface DriveFile {
  id: string;
  name: string;
}

async function findFile(name: string): Promise<DriveFile | undefined> {
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${name.replaceAll("'", "\\'")}'`,
    fields: "files(id,name)",
    pageSize: "10",
  });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${query}`,
    { headers: { Authorization: `Bearer ${accessToken()}` } },
  );
  if (!response.ok)
    throw await googleApiError(response, "Google Drive file lookup failed");
  const result = (await response.json()) as { files?: DriveFile[] };
  return result.files?.[0];
}

async function createFile(name: string, contents: string) {
  const boundary = `nutri_notes_${Date.now()}`;
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ name, parents: ["appDataFolder"] }),
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      contents,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok)
    throw await googleApiError(response, "Google Drive backup creation failed");
}

async function updateFile(id: string, contents: string) {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
      },
      body: new Blob([contents], { type: "application/json" }),
    },
  );
  if (!response.ok)
    throw await googleApiError(response, "Google Drive backup update failed");
}

async function uploadFile(name: string, contents: string) {
  const existing = await findFile(name);
  if (existing) await updateFile(existing.id, contents);
  else await createFile(name, contents);
}

async function uploadBackup() {
  const backup = await createFullBackup();
  const contents = JSON.stringify(backup, null, 2);
  await uploadFile("nutri-notes-latest.json", contents);
  await uploadFile(`nutri-notes-${isoDate(new Date())}.json`, contents);
  const auth = readAuth();
  if (auth)
    writeAuth({
      ...auth,
      lastBackupAt: new Date().toISOString(),
      lastError: undefined,
    });
  localStorage.setItem(DIRTY_KEY, "false");
}

async function downloadLatest() {
  const file = await findFile("nutri-notes-latest.json");
  if (!file) throw new Error("No Google Drive backup exists yet");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken()}` } },
  );
  if (!response.ok)
    throw await googleApiError(response, "Google Drive restore failed");
  return parseBackup(JSON.parse(await response.text()));
}

async function revokeConnection() {
  const auth = readAuth();
  try {
    if (auth?.accessToken && hasValidToken(auth)) {
      const oauth2 = await loadGoogleIdentity();
      await new Promise<void>((resolve) => oauth2.revoke(auth.accessToken!, resolve));
    }
  } finally {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(DIRTY_KEY);
  }
}

export function useGoogleDriveBackup(prepareIdentity = false): GoogleDriveBackupController {
  const [state, setState] = useState(() => publicState(readAuth()));
  const [identityReady, setIdentityReady] = useState(
    () => Boolean(window.google?.accounts.oauth2),
  );
  const [identityError, setIdentityError] = useState<string>();
  const timer = useRef<number>();
  const running = useRef(false);
  const refreshState = useCallback(
    (busy = false) =>
      setState(publicState(readAuth(), busy, identityReady, identityError)),
    [identityError, identityReady],
  );

  useEffect(() => {
    if (!prepareIdentity || identityReady) return;
    let active = true;
    loadGoogleIdentity()
      .then(() => {
        if (active) {
          setIdentityReady(true);
          setIdentityError(undefined);
        }
      })
      .catch((ex) => {
        if (active)
          setIdentityError(
            ex instanceof Error
              ? ex.message
              : "Could not load Google authentication",
          );
      });
    return () => {
      active = false;
    };
  }, [identityReady, prepareIdentity]);

  const runBackup = useCallback(async (automatic = false): Promise<boolean> => {
    if (running.current || !readAuth()?.authorised || !navigator.onLine) return false;
    if (!hasValidToken()) {
      const auth = readAuth();
      if (auth)
        writeAuth({
          ...auth,
          lastError: "Reconnect Google Drive to resume automatic backups",
        });
      refreshState();
      return false;
    }
    const auth = readAuth();
    if (
      automatic &&
      auth?.lastBackupAt &&
      Date.now() - new Date(auth.lastBackupAt).getTime() < AUTO_BACKUP_THROTTLE
    ) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(
        () => void runBackup(true),
        AUTO_BACKUP_THROTTLE,
      );
      return false;
    }
    running.current = true;
    refreshState(true);
    try {
      await uploadBackup();
      return true;
    } catch (ex) {
      const authNow = readAuth();
      if (authNow)
        writeAuth({
          ...authNow,
          lastError:
            ex instanceof Error ? ex.message : "Google Drive backup failed",
        });
      return false;
    } finally {
      running.current = false;
      refreshState();
    }
  }, [refreshState]);

  const schedule = useCallback(() => {
    localStorage.setItem(DIRTY_KEY, "true");
    if (!readAuth()?.authorised) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runBackup(true), AUTO_BACKUP_DELAY);
  }, [runBackup]);

  useEffect(() => {
    const storageChanged = () => schedule();
    const online = () => {
      if (localStorage.getItem(DIRTY_KEY) === "true") schedule();
    };
    Dexie.on.storagemutated.subscribe(storageChanged);
    addEventListener("online", online);
    if (
      readAuth()?.authorised &&
      localStorage.getItem(DIRTY_KEY) === "true"
    )
      timer.current = window.setTimeout(() => void runBackup(true), 1_000);
    return () => {
      Dexie.on.storagemutated.unsubscribe(storageChanged);
      removeEventListener("online", online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runBackup, schedule]);

  return {
    ...state,
    ready: identityReady,
    lastError: state.lastError ?? identityError,
    connect: async () => {
      if (!identityReady) throw new Error("Google connection is still loading");
      await requestToken();
      try {
        await fetchAccount();
      } catch {
        // Account display details are optional and do not block backups.
      }
      localStorage.setItem(DIRTY_KEY, "true");
      refreshState();
      await runBackup(false);
    },
    disconnect: async () => {
      await revokeConnection();
      refreshState();
    },
    backupNow: async () => {
      localStorage.setItem(DIRTY_KEY, "true");
      const uploaded = await runBackup(false);
      if (!uploaded)
        throw new Error(readAuth()?.lastError ?? "Google Drive backup could not run");
    },
    restoreLatest: downloadLatest,
  };
}
