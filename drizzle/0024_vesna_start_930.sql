-- «Весна»: салон открывается в 9:30 — у Сурмакан и Керемет начало смены 9:30 (только если в графике ещё 9:00)
UPDATE "schedules" SET "start_minute" = 570
WHERE "start_minute" = 540 AND "staff_id" IN (
  SELECT st."id" FROM "staff" st JOIN "salons" sa ON sa."id" = st."salon_id"
  WHERE sa."slug" = 'vesna' AND st."name" IN ('Сурмакан', 'Керемет')
);
