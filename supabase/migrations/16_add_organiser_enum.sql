-- ============================================================
-- PulsePass — Add Organiser Enum
-- Migration: 16_add_organiser_enum.sql
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organiser';
