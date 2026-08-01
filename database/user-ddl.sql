-- DROP TABLE IF EXISTS users;
CREATE TABLE IF EXISTS users (
    shadow_id CHAR(9) PRIMARY KEY,
    encrypted_pii BLOB NOT NULL,
    university VARCHAR(100) NOT NULL,
    faculty VARCHAR(80) NOT NULL,
    hashed_dob CHAR(64) NOT NULL UNIQUE,
    hashed_uni_id CHAR(64) NOT NULL UNIQUE,
    hashed_firstname CHAR(64) NOT NULL,
    hashed_uni_email CHAR(64) NOT NULL UNIQUE;
);

ALTER TABLE IF EXISTS users ADD INDEX dob_idx (hashed_dob);
ALTER TABLE IF EXISTS users ADD INDEX email_idx (hashed_uni_email);
ALTER TABLE IF EXISTS users ADD INDEX uni_id_index (hashed_uni_id);
ALTER TABLE IF EXISTS users ADD INDEX name_idx (hashed_firstname);

ALTER TABLE users 
    MODIFY COLUMN hashed_dob COMMENT 'DOB hashed by SHA3-256';

ALTER TABLE users 
    MODIFY COLUMN hashed_uni_email COMMENT 'University email hashed by SHA3-256';

ALTER TABLE users 
    MODIFY COLUMN hashed_uni_id COMMENT 'University id number hashed by SHA3-256';

ALTER TABLE users 
    MODIFY COLUMN hashed_firstname COMMENT 'First name hashed by SHA3-256';