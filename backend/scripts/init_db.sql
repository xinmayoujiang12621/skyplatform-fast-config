SET NAMES utf8mb4;
SET
FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS services
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    code
    VARCHAR
(
    64
) NOT NULL UNIQUE,
    name VARCHAR
(
    128
) NOT NULL,
    owner VARCHAR
(
    128
) NULL,
    active TINYINT
(
    1
) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_credentials
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    service_id
    BIGINT
    UNSIGNED
    NOT
    NULL,
    ak
    VARCHAR
(
    64
) NOT NULL UNIQUE,
    sk_ciphertext VARBINARY
(
    512
) NOT NULL,
    status ENUM
(
    'active',
    'disabled'
) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_rotated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_cred_service FOREIGN KEY
(
    service_id
) REFERENCES services
(
    id
) ON DELETE CASCADE,
    INDEX idx_cred_service
(
    service_id
),
    INDEX idx_cred_status
(
    status
)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS configs
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    service_id
    BIGINT
    UNSIGNED
    NOT
    NULL,
    env
    VARCHAR
(
    32
) NOT NULL,
    format ENUM
(
    'json',
    'yaml',
    'toml',
    'ini'
) NOT NULL,
    content LONGTEXT NOT NULL,
    schema_def LONGTEXT NULL,
    version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    is_published TINYINT
(
    1
) NOT NULL DEFAULT 0,
    updated_by VARCHAR
(
    128
) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cfg_service FOREIGN KEY
(
    service_id
) REFERENCES services
(
    id
)
                                                            ON DELETE CASCADE,
    UNIQUE KEY uk_cfg_service_env
(
    service_id,
    env
),
    INDEX idx_cfg_published
(
    is_published
)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS config_versions
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    config_id
    BIGINT
    UNSIGNED
    NOT
    NULL,
    version
    BIGINT
    UNSIGNED
    NOT
    NULL,
    content
    LONGTEXT
    NOT
    NULL,
    summary
    VARCHAR
(
    256
) NULL,
    created_by VARCHAR
(
    128
) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cfgver_cfg FOREIGN KEY
(
    config_id
) REFERENCES configs
(
    id
) ON DELETE CASCADE,
    UNIQUE KEY uk_cfgver_cfg_ver
(
    config_id,
    version
),
    INDEX idx_cfgver_created
(
    created_at
)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    actor
    VARCHAR
(
    128
) NULL,
    action VARCHAR
(
    64
) NOT NULL,
    target_type VARCHAR
(
    64
) NOT NULL,
    target_id BIGINT UNSIGNED NULL,
    detail LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_target
(
    target_type,
    target_id
),
    INDEX idx_audit_created
(
    created_at
)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users
(
    id
    BIGINT
    UNSIGNED
    PRIMARY
    KEY
    AUTO_INCREMENT,
    username
    VARCHAR
(
    64
) NOT NULL UNIQUE,
    password_hash VARCHAR
(
    255
) NOT NULL,
    role ENUM
(
    'viewer',
    'editor',
    'admin'
) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET
FOREIGN_KEY_CHECKS = 1;
