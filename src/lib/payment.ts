// Оплата визита: часть или вся сумма баллами, баллы начисляются только с суммы, оплаченной деньгами,
// и доля мастера считается с той же денежной суммы (баллы — скидка, которую делят салон и мастер поровну).

export type PaymentInput = {
  /** Фактическая цена услуги, сом */
  price: number;
  /** Сколько баллов клиент хочет списать (1 балл = 1 сом) */
  points: number;
  /** Сколько баллов у клиента на счёте */
  balance: number;
  /** % начисления баллов (у «Весны» 5) */
  earnPercent: number;
  /** % мастеру (у «Весны» 50; у хозяйки-мастера 0) */
  masterPercent: number;
  /** Порог: списывать баллы можно, только когда на счёте не меньше стольких баллов (0 — без порога) */
  minRedeem?: number;
};

export type Payment = {
  price: number;
  pointsUsed: number;
  cash: number;
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
  const cash = p.price - p.points;
  const pointsEarned = Math.floor((cash * p.earnPercent) / 100);
  const masterShare = Math.round((cash * p.masterPercent) / 100);
  return {
    price: p.price, pointsUsed: p.points, cash, pointsEarned,
    balanceAfter: p.balance - p.points + pointsEarned,
    masterPercent: p.masterPercent, masterShare, salonShare: cash - masterShare,
  };
}
