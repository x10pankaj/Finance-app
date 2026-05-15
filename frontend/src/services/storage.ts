/**
 * Local encrypted storage using AsyncStorage + crypto-js AES.
 * Works on all platforms: iOS, Android, Web — zero server dependency.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const PREFIX = 'budget_';
const PROFILES_KEY = `${PREFIX}profiles`;

// ── Helpers ─────────────────────────────────────────────────

function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 10000 }).toString();
}

function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

function decrypt(ciphertext: string, key: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const text = bytes.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 50000 }).toString();
}

// ── Profile Management ──────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
}

interface ProfileData {
  id: string;
  name: string;
  salt: string;
  hash: string;
}

async function getAllProfileData(): Promise<ProfileData[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAllProfileData(profiles: ProfileData[]) {
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export async function getProfiles(): Promise<Profile[]> {
  const data = await getAllProfileData();
  return data.map(({ id, name }) => ({ id, name }));
}

export async function createProfile(name: string, password: string): Promise<Profile> {
  const profiles = await getAllProfileData();
  const id = Math.random().toString(36).substring(2, 10);
  const salt = CryptoJS.lib.WordArray.random(16).toString();
  const hash = hashPassword(password, salt);
  profiles.push({ id, name, salt, hash });
  await saveAllProfileData(profiles);
  return { id, name };
}

export async function verifyProfilePassword(profileId: string, password: string): Promise<boolean> {
  const profiles = await getAllProfileData();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return false;
  return hashPassword(password, profile.salt) === profile.hash;
}

export async function getProfileSalt(profileId: string): Promise<string> {
  const profiles = await getAllProfileData();
  const profile = profiles.find((p) => p.id === profileId);
  return profile?.salt || '';
}

export async function deleteProfileData(profileId: string): Promise<boolean> {
  const profiles = await getAllProfileData();
  const filtered = profiles.filter((p) => p.id !== profileId);
  if (filtered.length === profiles.length) return false;
  await saveAllProfileData(filtered);
  // Delete all collection data for this profile
  const keys = await AsyncStorage.getAllKeys();
  const profileKeys = keys.filter((k) => k.startsWith(`${PREFIX}${profileId}_`));
  if (profileKeys.length > 0) await AsyncStorage.multiRemove(profileKeys);
  return true;
}

// ── Encrypted Collection ────────────────────────────────────

export class EncryptedCollection {
  private storageKey: string;
  private key: string;

  constructor(name: string, profileId: string, encKey: string) {
    this.storageKey = `${PREFIX}${profileId}_${name}`;
    this.key = encKey;
  }

  async readAll(): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (!raw) return [];
      const decrypted = decrypt(raw, this.key);
      return decrypted ? JSON.parse(decrypted) : [];
    } catch {
      return [];
    }
  }

  async writeAll(docs: any[]): Promise<void> {
    const ciphertext = encrypt(JSON.stringify(docs), this.key);
    await AsyncStorage.setItem(this.storageKey, ciphertext);
  }

  async find(query?: Record<string, any>): Promise<any[]> {
    const docs = await this.readAll();
    if (!query) return docs;
    return docs.filter((d) => Object.entries(query).every(([k, v]) => d[k] === v));
  }

  async findOne(query: Record<string, any>): Promise<any | null> {
    const docs = await this.readAll();
    return docs.find((d) => Object.entries(query).every(([k, v]) => d[k] === v)) || null;
  }

  async count(query?: Record<string, any>): Promise<number> {
    return (await this.find(query)).length;
  }

  async insert(doc: any): Promise<void> {
    const docs = await this.readAll();
    docs.push(doc);
    await this.writeAll(docs);
  }

  async update(query: Record<string, any>, updates: Record<string, any>): Promise<number> {
    const docs = await this.readAll();
    let matched = 0;
    for (let i = 0; i < docs.length; i++) {
      if (Object.entries(query).every(([k, v]) => docs[i][k] === v)) {
        Object.assign(docs[i], updates);
        matched++;
        break;
      }
    }
    if (matched > 0) await this.writeAll(docs);
    return matched;
  }

  async deleteOne(query: Record<string, any>): Promise<number> {
    const docs = await this.readAll();
    const idx = docs.findIndex((d) => Object.entries(query).every(([k, v]) => d[k] === v));
    if (idx === -1) return 0;
    docs.splice(idx, 1);
    await this.writeAll(docs);
    return 1;
  }
}

// ── Database ────────────────────────────────────────────────

export class LocalDatabase {
  private profileId: string;
  private encKey: string;
  private collections: Map<string, EncryptedCollection> = new Map();

  constructor(profileId: string, encKey: string) {
    this.profileId = profileId;
    this.encKey = encKey;
  }

  collection(name: string): EncryptedCollection {
    if (!this.collections.has(name)) {
      this.collections.set(name, new EncryptedCollection(name, this.profileId, this.encKey));
    }
    return this.collections.get(name)!;
  }

  get expenses() { return this.collection('expenses'); }
  get income_sources() { return this.collection('income_sources'); }
  get investments() { return this.collection('investments'); }
  get expense_categories() { return this.collection('expense_categories'); }
  get investment_types() { return this.collection('investment_types'); }
  get settings() { return this.collection('settings'); }
}

// ── Singleton DB ────────────────────────────────────────────

let _db: LocalDatabase | null = null;

export function getDB(): LocalDatabase {
  if (!_db) throw new Error('Not authenticated');
  return _db;
}

export function isAuthenticated(): boolean {
  return _db !== null;
}

export async function authenticate(profileId: string, password: string): Promise<boolean> {
  const ok = await verifyProfilePassword(profileId, password);
  if (!ok) return false;
  const salt = await getProfileSalt(profileId);
  const encKey = deriveKey(password, salt);
  _db = new LocalDatabase(profileId, encKey);
  return true;
}

export async function authenticateNewProfile(profileId: string, password: string): Promise<void> {
  const salt = await getProfileSalt(profileId);
  const encKey = deriveKey(password, salt);
  _db = new LocalDatabase(profileId, encKey);
}

export function logout() {
  _db = null;
}
