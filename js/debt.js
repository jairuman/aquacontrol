/* =============================================
   debt.js — Cálculo de deudas
   calcDebt ahora recibe db como parámetro
   en vez de llamar loadDB() ella misma
   ============================================= */

/**
 * @param {Object} client
 * @param {Object} db — la base de datos ya cargada (await loadDB())
 */
function calcDebt(client, db) {
  const payments  = db.payments.filter(p => p.clientId === client.id);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const regDate  = new Date(client.registrationDate);
  const now      = new Date();

  let billedMonths = (now.getFullYear() - regDate.getFullYear()) * 12
                   + (now.getMonth()   - regDate.getMonth()) + 1;
  if (billedMonths < 1) billedMonths = 1;

  const totalDue      = billedMonths * client.monthlyFee;
  const balance       = totalPaid - totalDue;
  const debt          = balance < 0 ? Math.abs(balance) : 0;
  const prepaidMonths = balance > 0 ? Math.floor(balance / client.monthlyFee) : 0;
  const unpaidMonths  = debt   > 0 ? Math.ceil(debt   / client.monthlyFee) : 0;

  return { totalDue, totalPaid, debt, billedMonths, unpaidMonths, prepaidMonths, balance };
}

/**
 * @param {Object} client
 * @param {number} year
 * @param {number} month  — 0-indexed
 * @param {Object} db — la base de datos ya cargada
 */
function getMonthStatus(client, year, month, db) {
  const { billedMonths } = calcDebt(client, db);
  const payments      = db.payments.filter(p => p.clientId === client.id);
  const totalPaid     = payments.reduce((s, p) => s + p.amount, 0);
  const regDate       = new Date(client.registrationDate);
  const monthIndex    = (year - regDate.getFullYear()) * 12 + (month - regDate.getMonth());
  const coveredMonths = Math.floor(totalPaid / client.monthlyFee);

  if (monthIndex < 0)             return 'future';
  if (monthIndex < coveredMonths) return 'paid';
  if (monthIndex < billedMonths)  return 'unpaid';
  return 'prepaid';
}