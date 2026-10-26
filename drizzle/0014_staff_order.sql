-- «Весна»: Жаннат — сразу после Анастасии (старшие мастера), остальные сдвигаются
UPDATE "staff" SET "sort_order" = CASE "name"
  WHEN 'Сурмакан' THEN 0 WHEN 'Анастасия' THEN 1 WHEN 'Жаннат' THEN 2 WHEN 'Диана' THEN 3 WHEN 'Керемет' THEN 4
  WHEN 'Жамиля' THEN 5 WHEN 'Азиза' THEN 6 WHEN 'Залина' THEN 7 WHEN 'Рэйна' THEN 8 ELSE "sort_order" END
WHERE "salon_id" = (SELECT "id" FROM "salons" WHERE "slug" = 'vesna');
