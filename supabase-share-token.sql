-- Migration: Add share_token column to proyectos table
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE proyectos ADD COLUMN share_token UUID DEFAULT NULL UNIQUE;

CREATE INDEX idx_proyectos_share_token ON proyectos (share_token) WHERE share_token IS NOT NULL;
