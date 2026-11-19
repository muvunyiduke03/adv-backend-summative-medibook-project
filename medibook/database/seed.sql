USE medibook;

INSERT INTO patients (patient_name, patient_email, patient_phone) VALUES
  ('Ama Mensah', 'ama@mail.com', '0244-111-222'),
  ('Kojo Owusu', 'kojo@mail.com', '0555-333-444'),
  ('Efua Asante', 'efua.asante@mail.com', '0201-555-678'),
  ('Yaw Darko', 'yaw.darko@mail.com', '0277-908-123'),
  ('Akosua Frimpong', 'akosua.f@mail.com', '0244-765-432');


INSERT INTO doctors (doctor_name, speciality, consultation_fee, room) VALUES
  ('Dr. Boateng', 'Dermatology', 150.00, 'R-12'),
  ('Dr. Adjei', 'Paediatrics', 100.00, 'R-03'),
  ('Dr. Kwarteng', 'General Practice', 80.00, 'R-05'),
  ('Dr. Amoah', 'Cardiology', 200.00, 'R-08');


INSERT INTO appointments (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, status, booked_on) VALUES
  ('AP-001', 1, 1, '2026-12-07 09:00:00', 150.00, 'BOOKED', '2026-11-01 10:15:00'),
  ('AP-002', 2, 1, '2026-12-07 09:30:00', 120.00, 'BOOKED', '2026-11-02 11:00:00'),
  ('AP-003', 1, 2, '2026-12-11 10:00:00', 100.00, 'BOOKED', '2026-11-03 08:40:00'),
  ('AP-004', 3, 1, '2026-12-07 10:00:00', 150.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-005', 4, 1, '2026-12-07 10:30:00', 0.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-006', 5, 1, '2026-12-07 11:00:00', 150.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-007', 3, 1, '2026-12-07 11:30:00', 150.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-008', 4, 1, '2026-12-07 12:00:00', 0.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-009', 5, 1, '2026-12-07 12:30:00', 150.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-010', 2, 1, '2026-12-07 13:00:00', 0.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-011', 3, 1, '2026-12-07 13:30:00', 150.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-012', 4, 1, '2026-12-07 14:00:00', 0.00, 'BOOKED', '2026-11-05 14:00:00'),
  ('AP-013', 5, 1, '2026-12-07 14:30:00', 150.00, 'BOOKED', '2026-11-05 14:00:00');


INSERT INTO appointments (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, status, booked_on, cancelled_at, refund_amount) VALUES
  ('AP-014', 4, 3, '2026-12-08 09:00:00', 0.00, 'CANCELLED', '2026-11-06 09:00:00', '2026-11-07 10:00:00', 0.00);

INSERT INTO appointments (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, status, booked_on) VALUES
  ('AP-015', 5, 3, '2026-12-08 09:00:00', 80.00, 'BOOKED', '2026-11-08 16:20:00'),
  ('AP-016', 2, 3, '2026-12-08 11:30:00', 80.00, 'BOOKED', '2026-11-09 12:05:00'),
  ('AP-017', 3, 2, '2026-12-11 14:30:00', 100.00, 'BOOKED', '2026-11-10 10:30:00'),
  ('AP-018', 5, 2, '2026-12-12 16:30:00', 0.00, 'BOOKED', '2026-11-12 13:45:00');