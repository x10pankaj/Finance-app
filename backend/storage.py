"""
Encrypted local file storage using AES (Fernet) with PBKDF2 key derivation.
All data stored as password-encrypted JSON files on disk.
"""

import json
import os
import hashlib
import base64
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

PROFILES_FILE = DATA_DIR / "profiles.json"


def _get_profiles() -> list[dict]:
    if not PROFILES_FILE.exists():
        return []
    try:
        return json.loads(PROFILES_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def _save_profiles(profiles: list[dict]) -> None:
    PROFILES_FILE.write_text(json.dumps(profiles))


def get_all_profiles() -> list[dict]:
    """Return list of profiles (id, name) — no secrets."""
    return [{"id": p["id"], "name": p["name"]} for p in _get_profiles()]


def create_profile(name: str, password: str) -> dict:
    """Create a new profile with its own data directory."""
    profiles = _get_profiles()
    profile_id = str(__import__("uuid").uuid4())[:8]
    profile_dir = DATA_DIR / profile_id
    profile_dir.mkdir(exist_ok=True)

    salt = os.urandom(16)
    (profile_dir / ".salt").write_bytes(salt)

    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000).hex()
    (profile_dir / ".password_hash").write_text(pw_hash)

    profiles.append({"id": profile_id, "name": name})
    _save_profiles(profiles)
    return {"id": profile_id, "name": name}


def verify_profile_password(profile_id: str, password: str) -> bool:
    profile_dir = DATA_DIR / profile_id
    salt_file = profile_dir / ".salt"
    hash_file = profile_dir / ".password_hash"
    if not salt_file.exists() or not hash_file.exists():
        return False
    salt = salt_file.read_bytes()
    expected = hash_file.read_text()
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000).hex()
    return expected == actual


def delete_profile(profile_id: str) -> bool:
    profiles = _get_profiles()
    new_profiles = [p for p in profiles if p["id"] != profile_id]
    if len(new_profiles) == len(profiles):
        return False
    _save_profiles(new_profiles)
    profile_dir = DATA_DIR / profile_id
    if profile_dir.exists():
        import shutil
        shutil.rmtree(profile_dir)
    return True


# Legacy single-profile helpers (kept for backward compat)
SALT_FILE = DATA_DIR / ".salt"
PASSWORD_HASH_FILE = DATA_DIR / ".password_hash"


def _get_or_create_salt() -> bytes:
    if SALT_FILE.exists():
        return SALT_FILE.read_bytes()
    salt = os.urandom(16)
    SALT_FILE.write_bytes(salt)
    return salt


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def _hash_password(password: str) -> str:
    salt = _get_or_create_salt()
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, 100_000
    ).hex()


# ── Password management ──────────────────────────────────────

def is_password_set() -> bool:
    return PASSWORD_HASH_FILE.exists()


def setup_password(password: str) -> bool:
    if is_password_set():
        return False
    PASSWORD_HASH_FILE.write_text(_hash_password(password))
    return True


def verify_password(password: str) -> bool:
    if not is_password_set():
        return False
    stored = PASSWORD_HASH_FILE.read_text()
    return stored == _hash_password(password)


def change_password(old_password: str, new_password: str) -> bool:
    if not verify_password(old_password):
        return False
    # Re-encrypt all data files with the new key
    old_salt = _get_or_create_salt()
    old_key = _derive_key(old_password, old_salt)
    old_fernet = Fernet(old_key)

    # Read all existing data
    collections_data = {}
    for f in DATA_DIR.glob("*.enc"):
        name = f.stem
        try:
            raw = old_fernet.decrypt(f.read_bytes())
            collections_data[name] = json.loads(raw)
        except InvalidToken:
            continue

    # Update password hash
    PASSWORD_HASH_FILE.write_text(_hash_password(new_password))

    # Re-encrypt with new key
    new_key = _derive_key(new_password, old_salt)
    new_fernet = Fernet(new_key)
    for name, data in collections_data.items():
        encrypted = new_fernet.encrypt(json.dumps(data).encode())
        (DATA_DIR / f"{name}.enc").write_bytes(encrypted)

    return True


# ── Encrypted collection (replacement for MongoDB collection) ─

class EncryptedCollection:
    """Drop-in replacement for a Mongo-like collection backed by an encrypted JSON file."""

    def __init__(self, name: str, password: str, data_dir: Path | None = None):
        self._name = name
        base = data_dir or DATA_DIR
        self._path = base / f"{name}.enc"
        salt_file = base / ".salt"
        salt = salt_file.read_bytes() if salt_file.exists() else _get_or_create_salt()
        self._fernet = Fernet(_derive_key(password, salt))

    # ── internal helpers ──

    def _read_all(self) -> list[dict]:
        if not self._path.exists():
            return []
        try:
            raw = self._fernet.decrypt(self._path.read_bytes())
            return json.loads(raw)
        except (InvalidToken, json.JSONDecodeError):
            return []

    def _write_all(self, docs: list[dict]) -> None:
        encrypted = self._fernet.encrypt(json.dumps(docs, default=str).encode())
        self._path.write_bytes(encrypted)

    # ── public Mongo-like API ──

    async def find(self, query: dict | None = None) -> list[dict]:
        docs = self._read_all()
        if not query:
            return docs
        return [d for d in docs if all(d.get(k) == v for k, v in query.items())]

    async def to_list(self, limit: int = 1000) -> list[dict]:
        return self._read_all()[:limit]

    async def find_one(self, query: dict) -> dict | None:
        for d in self._read_all():
            if all(d.get(k) == v for k, v in query.items()):
                return d
        return None

    async def count_documents(self, query: dict | None = None) -> int:
        if not query:
            return len(self._read_all())
        return len(await self.find(query))

    async def insert_one(self, doc: dict) -> None:
        docs = self._read_all()
        docs.append(doc)
        self._write_all(docs)

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        docs = self._read_all()
        matched = 0
        for i, d in enumerate(docs):
            if all(d.get(k) == v for k, v in query.items()):
                if "$set" in update:
                    docs[i].update(update["$set"])
                matched += 1
                break
        if matched == 0 and upsert and "$set" in update:
            new_doc = {**query, **update["$set"]}
            docs.append(new_doc)
            matched = 1
        self._write_all(docs)

        class _Result:
            def __init__(self, n):
                self.matched_count = n
        return _Result(matched)

    async def delete_one(self, query: dict):
        docs = self._read_all()
        new_docs = []
        deleted = 0
        for d in docs:
            if deleted == 0 and all(d.get(k) == v for k, v in query.items()):
                deleted += 1
                continue
            new_docs.append(d)
        self._write_all(new_docs)

        class _Result:
            def __init__(self, n):
                self.deleted_count = n
        return _Result(deleted)


class EncryptedDB:
    """Mimics motor's db[collection_name] access pattern."""

    def __init__(self, password: str, profile_id: str | None = None):
        self._password = password
        self._data_dir = (DATA_DIR / profile_id) if profile_id else DATA_DIR
        self._data_dir.mkdir(exist_ok=True)
        self._collections: dict[str, EncryptedCollection] = {}

    def __getattr__(self, name: str) -> EncryptedCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = EncryptedCollection(name, self._password, self._data_dir)
        return self._collections[name]

    def __getitem__(self, name: str) -> EncryptedCollection:
        return self.__getattr__(name)

    def refresh(self, password: str):
        """Re-create collections with a new password."""
        self._password = password
        self._collections.clear()
