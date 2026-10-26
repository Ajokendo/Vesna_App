// Код первичной настройки для нового салона: печатает код (отдать владельцу) и хеш (в salons.config.ts).
// Запуск: npx tsx src/db/setup-code.ts
import { randomBytes, scryptSync } from 'node:crypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join('').replace(/(.{5})(.{5})/, '$1-$2');
const salt = randomBytes(16).toString('hex');
console.log(`Код для владельца:  ${code}`);
console.log(`setupCodeHash:      '${salt}:${scryptSync(code, salt, 32).toString('hex')}'`);
