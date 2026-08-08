-- DROP TABLE IF EXISTS logins;
CREATE TABLE IF NOT EXISTS lumiere_iam_database.logins (
    login_id BINARY(16) PRIMARY KEY, -- Stored as UUIDv7
    shadow_id CHAR(9) NOT NULL,
    hashed_ip CHAR(96) NOT NULL,
    timestamps TIMESTAMP NOT NULL,
    success BOOLEAN NOT NULL
);

ALTER TABLE lumiere_iam_database.logins
    ADD CONSTRAINT fk_shadow_id 
    FOREIGN KEY (shadow_id) 
    REFERENCES lumiere_iam_database.users (shadow_id);

ALTER TABLE lumiere_iam_database.logins 
    MODIFY COLUMN login_id CHAR(36) COMMENT 'Generate by using UUIDv7';