CREATE DATABASE IF NOT EXISTS medibook
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;

CREATE TABLE patients (
  patient_id    INT         NOT NULL AUTO_INCREMENT,
  patient_name  VARCHAR(50) NOT NULL,
  patient_email VARCHAR(50) NOT NULL,
  patient_phone VARCHAR(50) NOT NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_id),
  CONSTRAINT uq_patients_email UNIQUE (patient_email)
) ENGINE=InnoDB;

CREATE TABLE doctors (
  doctor_id         INT             NOT NULL AUTO_INCREMENT,
  doctor_name       VARCHAR(50)     NOT NULL,
  speciality        VARCHAR(50)     NOT NULL,
  consultation_fee  DECIMAL(10, 2)  NOT NULL,
  room              VARCHAR(50)     NOT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (doctor_id),
  CONSTRAINT chck_doctor_fee CHECK (consultation_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  appointment_id    INT             NOT NULL AUTO_INCREMENT,
  appt_ref          VARCHAR(50)     NOT NULL,
  patient_id        INT             NOT NULL,
  doctor_id         INT             NOT NULL,
  appt_datetime     DATETIME        NOT NULL,
  amount_paid       DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  status            ENUM('BOOKED', 'CANCELLED', 'COMPLETED')  NOT NULL DEFAULT 'BOOKED',
  booked_on         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at      DATETIME        NULL,
  refund_amount     DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  active_slot       DATETIME GENERATED ALWAYS AS (IF(status = 'CANCELLED', NULL, appt_datetime)) STORED,
  PRIMARY KEY (appointment_id),
  CONSTRAINT uq_appt_ref            UNIQUE (appt_ref),
  CONSTRAINT uq_doctor_slot         UNIQUE (doctor_id, active_slot),
  CONSTRAINT chk_slot_30min         CHECK (MINUTE(appt_datetime) IN (0,30) AND SECOND(appt_datetime) = 0),
  CONSTRAINT chk_working_hours      CHECK (TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'),
  CONSTRAINT chk_amount_paid        CHECK (amount_paid >= 0),
  CONSTRAINT chk_refund_amount      CHECK (refund_amount >= 0 AND refund_amount <= amount_paid),
  CONSTRAINT chk_cancel_state       CHECK ((status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR (status <> 'CANCELLED' AND cancelled_at IS NULL AND refund_amount = 0)),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (doctor_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

