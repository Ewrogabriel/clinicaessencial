-- Cleanup script: Delete all agendamentos, enrollments, and weekly_schedules
-- This will remove all appointment and enrollment data

-- Delete all agendamentos (appointments)
DELETE FROM agendamentos;

-- Delete all weekly_schedules
DELETE FROM weekly_schedules;

-- Delete all enrollments
DELETE FROM enrollments;

-- Reset auto-increment sequences
ALTER SEQUENCE agendamentos_id_seq RESTART WITH 1;
ALTER SEQUENCE weekly_schedules_id_seq RESTART WITH 1;
ALTER SEQUENCE enrollments_id_seq RESTART WITH 1;
