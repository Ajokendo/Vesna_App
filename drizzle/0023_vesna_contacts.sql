-- «Весна»: верный номер WhatsApp Business и начало работы в 9:30 (только если значения ещё старые — правки хозяйки не трогаем)
UPDATE "salons" SET "whatsapp" = '+996 704 81-45-55' WHERE "slug" = 'vesna' AND "whatsapp" = '+996 702 81-45-55';--> statement-breakpoint
UPDATE "salons" SET "hours_text" = 'С 09:30 до 20:00, у каждого мастера свой график' WHERE "slug" = 'vesna' AND "hours_text" = 'С 09:00 до 20:00, у каждого мастера свой график';
