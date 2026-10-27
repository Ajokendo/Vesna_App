// Оплата визита: часть или вся сумма баллами, баллы начисляются только с суммы, оплаченной деньгами,
// и доля мастера считается с той же денежной суммы (подарочный сертификат — тоже деньги, полученные заранее) (баллы — скидка, которую делят салон и мастер поровну).

export type PaymentInput = {
  /** Фактическая цена услуги, сом */
  price: number;
  /** Сколько баллов клиент хочет списать (1 балл = 1 сом) */
  points: number;
  /** Сколько баллов у клиента на счёте */
  balance: number;
  /** % начисления баллов (у «Весны» 5) */
  earnPercent: number;
  /** % мастеру (у «Весны» 50; у директора-мастера 0) */
  masterPercent: number;
  /** Порог: списывать баллы можно, только когда на счёте не меньше стольких баллов (0 — без порога) */
  minRedeem?: number;
  /** Сколько оплатить подарочным сертификатом (после баллов) и сколько на нём осталось */
  cert?: number;
  certBalance?: number;
};

export type Payment = {
  price: number;
  pointsUsed: number;
  /** Деньгами сейчас (без сертификата) */
  cash: number;
  /** Подарочным сертификатом — это тоже деньги, полученные салоном раньше, при продаже сертификата */
  cert: number;
  pointsEarned: number;
  balanceAfter: number;
  masterPercent: number;
  masterShare: number;
  salonShare: number;
};

export function calcPayment(p: PaymentInput): Payment {
  if (!Number.isInteger(p.price) || p.price < 0) throw new Error('Укажите цену');
  if (!Number.isInteger(p.points) || p.points < 0) throw new Error('Баллы — целое число');
  if (p.points > p.balance) throw new Error(`На счёте только ${p.balance} баллов`);
  if (p.points > p.price) throw new Error('Баллов больше, чем стоит услуга');
  if (p.points > 0 && p.minRedeem && p.balance < p.minRedeem) throw new Error(`Списывать баллы можно, когда на счёте не меньше ${p.minRedeem}`);
  const cert = p.cert ?? 0;
  if (!Number.isInteger(cert) || cert < 0) throw new Error('Сумма сертификата — целое число');
  if (cert > (p.certBalance ?? 0)) throw new Error(`На сертификате только ${p.certBalance ?? 0} сом`);
  if (cert > p.price - p.points) throw new Error('По сертификату больше, чем осталось оплатить');
  const cash = p.price - p.points - cert;
  // баллы и доля мастера — с суммы, оплаченной деньгами, включая сертификат
  const money = cash + cert;
  const pointsEarned = Math.floor((money * p.earnPercent) / 100);
  const masterShare = Math.round((money * p.masterPercent) / 100);
  return {
    price: p.price, pointsUsed: p.points, cash, cert, pointsEarned,
    balanceAfter: p.balance - p.points + pointsEarned,
    masterPercent: p.masterPercent, masterShare, salonShare: money - masterShare,
  };
}
