import 'server-only';
import { db, schema as s } from '@/db';

// WhatsApp-уведомления клиентам. Два способа отправки:
// 1) GREEN-API (green-api.com) — номер салона подключается как WhatsApp Web (QR-код в консоли Green-API),
//    сообщения — обычным текстом, без шаблонов Meta. Настройки сервера:
//      GREENAPI_ID    — idInstance из консоли Green-API;
//      GREENAPI_TOKEN — apiTokenInstance;
//      GREENAPI_URL   — apiUrl из консоли (по умолчанию https://api.green-api.com).
// 2) WhatsApp Business Platform (Cloud API, Meta) — по одобренным шаблонам (тексты ниже). Настройки:
//      WHATSAPP_TOKEN, WHATSAPP_PHONE_ID (у салона может быть свой: salons.wa_phone_id).
// Если задан GREENAPI_ID — используется Green-API. Если ничего не задано — WhatsApp выключен, работают push-уведомления.
// SITE_URL — адрес приложения для ссылок в сообщениях (по умолчанию https://vesna-app.vercel.app).

const GRAPH = process.env.WHATSAPP_GRAPH_URL ?? 'https://graph.facebook.com/v21.0';

/** Шаблоны: название в Meta, язык и текст (для создания в WhatsApp Manager). {{n}} — подставляемые значения */
export const WA_TEMPLATES = {
  booked: {
    name: 'appointment_booked', category: 'UTILITY',
    text: 'Здравствуйте, {{1}}! Вы записаны в салон «{{2}}» на {{3}}. Мастер и услуга: {{4}}. Адрес: {{5}}.',
    button: 'Открыть запись',
  },
  reminder: {
    name: 'appointment_reminder', category: 'UTILITY',
    text: '{{1}}, напоминаем: сегодня в {{2}} вас ждут в салоне «{{3}}». {{4}}. Если планы изменились — откройте запись или ответьте на это сообщение.',
    button: 'Подтвердить или перенести',
  },
  moved: {
    name: 'appointment_moved', category: 'UTILITY',
    text: '{{1}}, ваша запись в салон «{{2}}» изменилась: {{3}}, {{4}}.',
    button: 'Открыть запись',
  },
  cancelled: {
    name: 'appointment_cancelled', category: 'UTILITY',
    text: '{{1}}, ваша запись в салон «{{2}}» на {{3}} отменена. Выбрать другое время можно в приложении салона.',
    button: 'Записаться снова',
  },
  slot: {
    name: 'slot_available', category: 'UTILITY',
    text: '{{1}}, в салоне «{{2}}» освободилось время: {{3}}. {{4}}. Запишитесь, пока его не заняли.',
    button: 'Записаться',
  },
  /** Проверка из настроек салона (в Meta — стандартный шаблон hello_world) */
  test: {
    name: 'hello_world', category: 'UTILITY',
    text: '✅ Проверка: WhatsApp-уведомления салона «{{1}}» работают. Так клиенты будут получать подтверждение записи, напоминания, перенос и отмену.',
    button: '',
  },
} as const;

export type WaTemplate = keyof typeof WA_TEMPLATES;

const green = () => !!(process.env.GREENAPI_ID && process.env.GREENAPI_TOKEN);

/** Подключён ли номер для отправки (без учёта галочки салона) */
export function waProviderReady(salon: { waPhoneId: string | null }) {
  return green() || (!!process.env.WHATSAPP_TOKEN && !!(salon.waPhoneId || process.env.WHATSAPP_PHONE_ID));
}

export function waConfigured(salon: { waNotify: boolean; waPhoneId: string | null }) {
  return salon.waNotify && waProviderReady(salon);
}

/** Текст сообщения для Green-API: текст шаблона с подставленными значениями + ссылка с подписью кнопки */
export function waText(template: WaTemplate, params: string[], urlSuffix?: string) {
  const t = WA_TEMPLATES[template];
  let text: string = t.text.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? '');
  if (urlSuffix) {
    const base = (process.env.SITE_URL ?? 'https://vesna-app.vercel.app').replace(/\/$/, '');
    text += `\n\n${t.button}: ${base}/${urlSuffix.replace(/^\//, '')}`;
  }
  return text;
}

/** Номер для WhatsApp: только цифры, с кодом страны (0XXX… → 996XXX…, 9 цифр → 996 + номер) */
export function waNumber(phone: string | null | undefined) {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('0')) d = `996${d.slice(1)}`;
  if (d.length === 9) d = `996${d}`;
  return d.length >= 11 ? d : null;
}

/**
 * Отправить шаблон. params — значения {{1}}…{{n}}; urlSuffix — окончание ссылки кнопки (кнопка в шаблоне:
 * «Visit website», адрес вида https://vesna-app.vercel.app/{{1}}). Возвращает true, если Meta приняла сообщение.
 */
export async function sendWa(salon: { id: string; waNotify: boolean; waPhoneId: string | null }, input: {
  clientId?: string | null; phone: string | null | undefined; template: WaTemplate; params: string[]; urlSuffix?: string;
  /** проверка из настроек: отправить, даже если галочка «Уведомления в WhatsApp» выключена */
  test?: boolean;
}): Promise<boolean> {
  if (!(input.test ? waProviderReady(salon) : waConfigured(salon))) return false;
  const to = waNumber(input.phone);
  if (!to) return false;
  const t = WA_TEMPLATES[input.template];
  let status = 'FAILED'; let waId: string | null = null; let error: string | null = null;
  if (green()) {
    const base = (process.env.GREENAPI_URL ?? 'https://api.green-api.com').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/waInstance${process.env.GREENAPI_ID}/sendMessage/${process.env.GREENAPI_TOKEN}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${to}@c.us`, message: waText(input.template, input.params, input.urlSuffix), linkPreview: false }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.idMessage) { status = 'SENT'; waId = d.idMessage; }
      else error = d.message ?? d.error ?? `HTTP ${res.status}`;
    } catch (e) { error = (e as Error).message; }
  } else {
    const components: unknown[] = [{ type: 'body', parameters: input.params.map((text) => ({ type: 'text', text: text.slice(0, 900) })) }];
    if (input.urlSuffix) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: input.urlSuffix.replace(/^\//, '') }] });
    const phoneId = salon.waPhoneId || process.env.WHATSAPP_PHONE_ID!;
    try {
      const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: input.template === 'test' ? { name: t.name, language: { code: 'en_US' } } : { name: t.name, language: { code: 'ru' }, components } }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.messages?.[0]?.id) { status = 'SENT'; waId = d.messages[0].id; }
      else error = d.error?.message ?? `HTTP ${res.status}`;
    } catch (e) { error = (e as Error).message; }
  }
  await db.insert(s.waMessages).values({ salonId: salon.id, clientId: input.clientId ?? null, to, template: t.name, status, waId, error }).catch(() => {});
  if (error) console.error('whatsapp', t.name, error);
  return status === 'SENT';
}
