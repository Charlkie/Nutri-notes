import { useCallback, useEffect, useRef, useState } from "react";
import Dexie from "dexie";
import { createFullBackup, db, isoDate } from "./data/db";
import { createId } from "./domain/id";
import { parseBackup, type BackupData } from "./domain/portability";

const DROPBOX_APP_KEY = "0fuqi1tfcdglsrj";
const AUTH_KEY = "nutri-notes.dropbox.auth";
const DIRTY_KEY = "nutri-notes.dropbox.dirty";
const OAUTH_KEY = "nutri-notes.dropbox.oauth";
const AUTO_BACKUP_DELAY = 8_000;
const AUTO_BACKUP_THROTTLE = 60_000;

interface StoredDropboxAuth {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  accountName?: string;
  accountEmail?: string;
  lastBackupAt?: string;
  lastError?: string;
}

interface OAuthPending {
  verifier: string;
  state: string;
  redirectUri: string;
  returnHash: string;
}

export interface DropboxBackupState {
  connected: boolean;
  accountName?: string;
  accountEmail?: string;
  lastBackupAt?: string;
  lastError?: string;
  busy: boolean;
}

export interface DropboxBackupController extends DropboxBackupState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreLatest: () => Promise<BackupData>;
}

const readAuth = (): StoredDropboxAuth | undefined => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as StoredDropboxAuth) : undefined;
  } catch {
    return undefined;
  }
};

const writeAuth = (auth: StoredDropboxAuth) =>
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));

const publicState = (
  auth: StoredDropboxAuth | undefined,
  busy = false,
): DropboxBackupState => ({
  connected: Boolean(auth?.refreshToken),
  accountName: auth?.accountName,
  accountEmail: auth?.accountEmail,
  lastBackupAt: auth?.lastBackupAt,
  lastError: auth?.lastError,
  busy,
});

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

async function pkceChallenge(verifier: string) {
  if (!crypto.subtle)
    throw new Error("Dropbox connection requires the secure HTTPS app");
  return base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
}

const redirectUri = () => `${location.origin}${location.pathname}`;

async function beginOAuth() {
  const verifier = `${createId()}${createId()}`.replaceAll("-", "");
  const state = createId();
  const redirect = redirectUri();
  const pending: OAuthPending = {
    verifier,
    state,
    redirectUri: redirect,
    returnHash: location.hash,
  };
  sessionStorage.setItem(OAUTH_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: "code",
    redirect_uri: redirect,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    token_access_type: "offline",
    scope: "account_info.read files.content.read files.content.write",
    state,
  });
  location.assign(`https://www.dropbox.com/oauth2/authorize?${params}`);
}

async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: DROPBOX_APP_KEY, ...parameters }),
  });
  if (!response.ok) throw new Error(`Dropbox authorization failed (${response.status})`);
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
}

async function finishOAuth(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error_description") ?? params.get("error");
  if (!code && !oauthError) return false;
  history.replaceState(null, "", location.pathname);
  if (oauthError) throw new Error(`Dropbox connection was not completed: ${oauthError}`);
  const rawPending = sessionStorage.getItem(OAUTH_KEY);
  sessionStorage.removeItem(OAUTH_KEY);
  if (!rawPending) throw new Error("Dropbox connection expired. Please try again.");
  const pending = JSON.parse(rawPending) as OAuthPending;
  if (returnedState !== pending.state)
    throw new Error("Dropbox connection could not be verified");
  history.replaceState(null, "", `${location.pathname}${pending.returnHash}`);
  dispatchEvent(new HashChangeEvent("hashchange"));
  const token = await tokenRequest({
    code: code!,
    grant_type: "authorization_code",
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier,
  });
  if (!token.refresh_token)
    throw new Error("Dropbox did not provide an automatic-backup token");
  const auth: StoredDropboxAuth = {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  writeAuth(auth);
  return true;
}

async function accessToken() {
  const auth = readAuth();
  if (!auth?.refreshToken) throw new Error("Dropbox is not connected");
  if (auth.accessToken && (auth.expiresAt ?? 0) > Date.now() + 60_000)
    return auth.accessToken;
  const token = await tokenRequest({
    refresh_token: auth.refreshToken,
    grant_type: "refresh_token",
  });
  writeAuth({
    ...auth,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    lastError: undefined,
  });
  return token.access_token;
}

async function fetchAccount() {
  const response = await fetch(
    "https://api.dropboxapi.com/2/users/get_current_account",
    { method: "POST", headers: { Authorization: `Bearer ${await accessToken()}` } },
  );
  if (!response.ok) throw new Error(`Could not read Dropbox account (${response.status})`);
  const account = (await response.json()) as {
    name?: { display_name?: string };
    email?: string;
  };
  const auth = readAuth();
  if (auth)
    writeAuth({
      ...auth,
      accountName: account.name?.display_name,
      accountEmail: account.email,
    });
}

async function uploadFile(path: string, contents: string) {
  const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: contents,
  });
  if (!response.ok) throw new Error(`Dropbox backup upload failed (${response.status})`);
}

async function uploadBackup() {
  const backup = await createFullBackup();
  const contents = JSON.stringify(backup, null, 2);
  await uploadFile("/nutri-notes-latest.json", contents);
  await uploadFile(`/nutri-notes-${isoDate(new Date())}.json`, contents);
  const completedAt = new Date().toISOString();
  const auth = readAuth();
  if (auth)
    writeAuth({ ...auth, lastBackupAt: completedAt, lastError: undefined });
  localStorage.setItem(DIRTY_KEY, "false");
}

async function downloadLatest() {
  const response = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Dropbox-API-Arg": JSON.stringify({ path: "/nutri-notes-latest.json" }),
    },
  });
  if (!response.ok) {
    if (response.status === 409) throw new Error("No Dropbox backup exists yet");
    throw new Error(`Dropbox restore failed (${response.status})`);
  }
  return parseBackup(JSON.parse(await response.text()));
}

async function revokeConnection() {
  try {
    if (navigator.onLine && readAuth()?.refreshToken) {
      await fetch("https://api.dropboxapi.com/2/auth/token/revoke", {
        method: "POST",
        headers: { Authorization: `Bearer ${await accessToken()}` },
      });
    }
  } finally {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(DIRTY_KEY);
    sessionStorage.removeItem(OAUTH_KEY);
  }
}

export function useDropboxBackup(): DropboxBackupController {
  const [state, setState] = useState(() => publicState(readAuth()));
  const timer = useRef<number>();
  const running = useRef(false);

  const refreshState = useCallback(
    (busy = false) => setState(publicState(readAuth(), busy)),
    [],
  );

  const runBackup = useCallback(async (automatic = false): Promise<boolean> => {
    if (running.current || !readAuth()?.refreshToken || !navigator.onLine) return false;
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
          lastError: ex instanceof Error ? ex.message : "Dropbox backup failed",
        });
      return false;
    } finally {
      running.current = false;
      refreshState(false);
    }
  }, [refreshState]);

  const schedule = useCallback(() => {
    localStorage.setItem(DIRTY_KEY, "true");
    if (!readAuth()?.refreshToken) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runBackup(true), AUTO_BACKUP_DELAY);
  }, [runBackup]);

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const connectedNow = await finishOAuth();
        if (connectedNow) {
          await db.open();
          try {
            await fetchAccount();
          } catch {
            // Profile details are helpful but must never block the backup itself.
          }
          localStorage.setItem(DIRTY_KEY, "true");
          if (active) refreshState();
          await runBackup(false);
        } else if (readAuth()?.refreshToken && localStorage.getItem(DIRTY_KEY) === "true") {
          timer.current = window.setTimeout(() => void runBackup(true), 1_000);
        }
      } catch (ex) {
        const auth = readAuth();
        if (auth)
          writeAuth({
            ...auth,
            lastError: ex instanceof Error ? ex.message : "Dropbox connection failed",
          });
        if (active) refreshState();
      }
    };
    const storageChanged = () => schedule();
    const online = () => {
      if (localStorage.getItem(DIRTY_KEY) === "true") schedule();
    };
    Dexie.on.storagemutated.subscribe(storageChanged);
    addEventListener("online", online);
    void initialise();
    return () => {
      active = false;
      Dexie.on.storagemutated.unsubscribe(storageChanged);
      removeEventListener("online", online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refreshState, runBackup, schedule]);

  return {
    ...state,
    connect: beginOAuth,
    disconnect: async () => {
      await revokeConnection();
      refreshState();
    },
    backupNow: async () => {
      localStorage.setItem(DIRTY_KEY, "true");
      const uploaded = await runBackup(false);
      if (!uploaded)
        throw new Error(readAuth()?.lastError ?? "Dropbox backup could not run");
    },
    restoreLatest: downloadLatest,
  };
}
