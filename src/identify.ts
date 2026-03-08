import db from "./db.js";
import type { ContactRow, IdentifyRequest, IdentifyResponse } from "./types.js";

function toStr(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v).trim() || null;
}

function now(): string {
  return new Date().toISOString();
}

function getPrimaryId(c: ContactRow, contacts: Map<number, ContactRow>): number {
  if (c.linkPrecedence === "primary" || c.linkedId === null) return c.id;
  const linked = contacts.get(c.linkedId);
  return linked ? getPrimaryId(linked, contacts) : c.id;
}

function getAllInLink(
  primaryId: number,
  contacts: Map<number, ContactRow>
): ContactRow[] {
  const result: ContactRow[] = [];
  for (const c of contacts.values()) {
    if (getPrimaryId(c, contacts) === primaryId) result.push(c);
  }
  return result;
}

export function identify(req: IdentifyRequest): IdentifyResponse {
  const email = toStr(req.email);
  const phoneNumber = toStr(req.phoneNumber);

  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber is required");
  }

  let matches: ContactRow[] = [];
  if (email || phoneNumber) {
    const conditions: string[] = [];
    const params: (string | null)[] = [];
    if (email) {
      conditions.push("email = ?");
      params.push(email);
    }
    if (phoneNumber) {
      conditions.push("phoneNumber = ?");
      params.push(phoneNumber);
    }
    const stmt = db.prepare(`
      SELECT * FROM Contact WHERE deletedAt IS NULL AND (${conditions.join(" OR ")})
    `);
    matches = stmt.all(...params) as ContactRow[];
  }

  if (matches.length === 0) {
    const insert = db.prepare(`
      INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
      VALUES (?, ?, NULL, 'primary', ?, ?)
    `);
    const r = insert.run(phoneNumber, email, now(), now());
    const id = (r as { lastInsertRowid: number }).lastInsertRowid;
    const emails = email ? [email] : [];
    const phoneNumbers = phoneNumber ? [phoneNumber] : [];
    return {
      contact: {
        primaryContatctId: id,
        emails,
        phoneNumbers,
        secondaryContactIds: [],
      },
    };
  }

  const contactMap = new Map<number, ContactRow>();
  for (const c of matches) contactMap.set(c.id, c);

  const primaryIds = new Set<number>();
  for (const c of matches) primaryIds.add(getPrimaryId(c, contactMap));

  const primaries = Array.from(primaryIds)
    .map((id) => contactMap.get(id)!)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const oldestPrimary = primaries[0];
  let primaryId = oldestPrimary.id;

  if (primaries.length > 1) {
    for (let i = 1; i < primaries.length; i++) {
      const p = primaries[i];
      db.prepare(
        "UPDATE Contact SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = ? WHERE id = ?"
      ).run(primaryId, now(), p.id);
      const secondariesOfP = db.prepare("SELECT id FROM Contact WHERE linkedId = ? AND deletedAt IS NULL").all(p.id) as { id: number }[];
      for (const s of secondariesOfP) {
        db.prepare("UPDATE Contact SET linkedId = ?, updatedAt = ? WHERE id = ?").run(
          primaryId,
          now(),
          s.id
        );
      }
    }
    contactMap.clear();
    const allContacts = db.prepare("SELECT * FROM Contact WHERE deletedAt IS NULL").all() as ContactRow[];
    for (const c of allContacts) contactMap.set(c.id, c);
  }

  const allInLink = getAllInLink(primaryId, contactMap);
  const existingEmails = new Set(allInLink.map((c) => c.email).filter(Boolean));
  const existingPhones = new Set(allInLink.map((c) => c.phoneNumber).filter(Boolean));

  const hasNewEmail = email && !existingEmails.has(email);
  const hasNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

  if (hasNewEmail || hasNewPhone) {
    const insert = db.prepare(`
      INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
      VALUES (?, ?, ?, 'secondary', ?, ?)
    `);
    insert.run(phoneNumber, email, primaryId, now(), now());
    const allContacts = db.prepare("SELECT * FROM Contact WHERE deletedAt IS NULL").all() as ContactRow[];
    contactMap.clear();
    for (const c of allContacts) contactMap.set(c.id, c);
  }

  const finalInLink = getAllInLink(primaryId, contactMap);
  const primaryContact = finalInLink.find((c) => c.id === primaryId) ?? finalInLink[0];
  const secondaryContacts = finalInLink.filter((c) => c.id !== primaryId);

  const allEmails = finalInLink.map((c) => c.email).filter(Boolean) as string[];
  const emails = [...new Set(allEmails)];
  const primaryEmail = primaryContact.email;
  if (primaryEmail && emails[0] !== primaryEmail) {
    emails.splice(emails.indexOf(primaryEmail), 1);
    emails.unshift(primaryEmail);
  }

  const allPhones = finalInLink.map((c) => c.phoneNumber).filter(Boolean) as string[];
  const phoneNumbers = [...new Set(allPhones)];
  const primaryPhone = primaryContact.phoneNumber;
  if (primaryPhone && phoneNumbers[0] !== primaryPhone) {
    phoneNumbers.splice(phoneNumbers.indexOf(primaryPhone), 1);
    phoneNumbers.unshift(primaryPhone);
  }

  return {
    contact: {
      primaryContatctId: primaryId,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaryContacts.map((c) => c.id).sort((a, b) => a - b),
    },
  };
}
