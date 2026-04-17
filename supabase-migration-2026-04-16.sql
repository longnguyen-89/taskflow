-- 2026-04-16: Them bang chi tiet mat hang cho de xuat (Mua hang + Thanh toan)
-- Moi item trong array: { name, unit, quantity, unit_price, note }
-- Tong gia = quantity * unit_price (tinh o client, khong luu de tranh drift)
-- Safe migration: dung IF NOT EXISTS de khong anh huong data hien co.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN proposals.items IS 'Array of detail items: [{name, unit, quantity, unit_price, note}]. Total = quantity * unit_price (computed client-side).';
