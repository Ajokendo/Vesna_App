-- Однократная очистка тестовых данных перед тестами салона: все записи, оплаты, баллы и клиенты.
-- Услуги, цены, мастера, графики и PIN мастеров не трогаются.
DELETE FROM "points_ledger";--> statement-breakpoint
DELETE FROM "appointment_addons";--> statement-breakpoint
DELETE FROM "appointments";--> statement-breakpoint
DELETE FROM "clients";
