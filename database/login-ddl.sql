-- DROP TABLE IF EXISTS logins;
CREATE TABLE IF NOT EXISTS logins (
    login_id CHAR(36) PRIMARY KEY,
    shadow_id CHAR(9) NOT NULL,
    hashed_ip CHAR(96) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    success BOOLEAN NOT NULL
);

ALTER TABLE logins
    ADD CONSTRAINT fk_shadow_id 
    FOREIGN KEY (shadow_id) 
    REFERENCES users (shadow_id);

ALTER TABLE logins 
    MODIFY COLUMN login_id COMMENT 'Generate by using UUIDv4';