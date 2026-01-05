-- Migration: Rename projects.contact_id to projects.client_id
-- This makes it clearer that projects are linked to client contacts

ALTER TABLE projects RENAME COLUMN contact_id TO client_id;
