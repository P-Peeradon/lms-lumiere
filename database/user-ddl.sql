-- DROP TABLE IF EXISTS lumiere_iam_database.users;
CREATE TABLE IF NOT EXISTS lumiere_iam_database.users (
    shadow_id CHAR(9) PRIMARY KEY,
    encrypted_pii BLOB,
    university VARCHAR(100) NOT NULL,
    faculty VARCHAR(80) NOT NULL,
    hashed_dob CHAR(64) NOT NULL UNIQUE,
    uni_id VARCHAR(12) NOT NULL UNIQUE,
    hashed_firstname CHAR(64) NOT NULL,
    uni_email VARCHAR(150) NOT NULL UNIQUE
);

ALTER TABLE lumiere_iam_database.users ADD INDEX dob_idx (hashed_dob);
ALTER TABLE lumiere_iam_database.users ADD INDEX email_idx (uni_email);
ALTER TABLE lumiere_iam_database.users ADD INDEX uni_id_index (uni_id);
ALTER TABLE lumiere_iam_database.users ADD INDEX name_idx (hashed_firstname);

ALTER TABLE lumiere_iam_database.users 
    MODIFY COLUMN hashed_dob CHAR(64) COMMENT 'DOB hashed by SHA3-256';

ALTER TABLE lumiere_iam_database.users 
    MODIFY COLUMN uni_email CHAR(64) COMMENT 'University email';

ALTER TABLE lumiere_iam_database.users 
    MODIFY COLUMN uni_id VARCHAR(12) COMMENT 'University id number';

ALTER TABLE lumiere_iam_database.users 
    MODIFY COLUMN hashed_firstname CHAR(64) COMMENT 'First name hashed by SHA3-256';