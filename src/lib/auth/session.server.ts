// src/lib/auth/session.server.ts
//
// Sessions "stateless" : le cookie contient directement les infos utilisateur
// (userId, role, expiration), signées par HMAC-SHA256. Pas de table
// `sessions` en base ni d'aller-retour DB pour vérifier une session — bon
// compromis perf pour un déploiement edge/serverless.
//
// Contrepartie assumée : on ne peut pas "révoquer" une session individuelle
// avant son expiration naturelle. Si besoin plus tard (ex: "déconnecter cet
// appareil"), ajouter une colonne `session_version` sur `profiles` et
// l'inclure dans le payload signé + vérifier qu'elle correspond à la valeur
// en base à chaque requête.
//
// Variable d'env requise : SESSION_SECRET (chaîne aléatoire longue, ex:
// générée avec `openssl rand -base64 48`). Ne JAMAIS la committer.

import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import type { AppRole } from "./types";

const COOKIE_NAME = "europermis_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14; // 14 jours

export type SessionPayload = {
  userId: string;
  role: AppRole;
  username: string;
  exp: number; // unix seconds
};

function base64UrlEncode(bytes: Uint8Array): string {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing or too-short SESSION_SECRET environment variable (need >= 32 chars). " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: SessionPayload): Promise<string> {
  const key = await getSigningKey();
  const json = JSON.stringify(payload);
  const dataBytes = new TextEncoder().encode(json);
  const signature = await crypto.subtle.sign("HMAC", key, dataBytes);

  const encodedPayload = base64UrlEncode(dataBytes);
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${encodedPayload}.${encodedSignature}`;
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;

  try {
    const key = await getSigningKey();
    const dataBytes = base64UrlDecode(encodedPayload);
    const signatureBytes = base64UrlDecode(encodedSignature);

    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(dataBytes)) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // expiré
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(user: { userId: string; role: AppRole; username: string }) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const token = await signPayload(payload);

  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token);
}

export function destroySession() {
  deleteCookie(COOKIE_NAME, { path: "/" });
}
