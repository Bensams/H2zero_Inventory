-- H2Zero Inventory System — schema aligned with Backend/routes and models
-- MySQL 5.7+ / 8.x / MariaDB 10.3+ | utf8mb4
--
-- Local XAMPP: run the whole file (creates database h2zero_inventory).
-- Railway / hosted DB: if the provider already created an empty database, comment out
-- the CREATE DATABASE and USE lines below, then run the rest against that database.
--
-- DBeaver: "Execute SQL Statement" (Ctrl+Enter) runs only ONE statement at the cursor.
-- Run the full script with "Execute SQL Script" (main toolbar play+document icon, or Alt+X),
-- or select the entire file first then execute. Ensure the connection is MySQL/MariaDB (not SQLite).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS h2zero_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE h2zero_inventory;

DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS stock_logs;
DROP TABLE IF EXISTS stocks;
DROP TABLE IF EXISTS stock_products;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(191) NOT NULL,
  age INT UNSIGNED NULL,
  gender VARCHAR(32) NULL,
  username VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE stock_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(191) NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_products_name (product_name),
  CONSTRAINT fk_stock_products_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE stocks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(191) NOT NULL,
  size_label VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stocks_product_size (product_name, size_label),
  CONSTRAINT fk_stocks_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE stock_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(191) NOT NULL,
  size_label VARCHAR(64) NOT NULL,
  quantity INT NOT NULL COMMENT 'Can be negative when logging inventory deductions',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_logs_created (created_at),
  KEY idx_stock_logs_product (product_name, size_label),
  CONSTRAINT fk_stock_logs_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE inventory (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_name VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(64) NOT NULL DEFAULT 'pcs',
  added_by INT UNSIGNED NOT NULL,
  date_added DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_date_added (date_added),
  CONSTRAINT fk_inventory_user FOREIGN KEY (added_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE activity_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_logs_created (created_at),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Optional: first admin — use a Gmail address (app validates @gmail.com for staff flows).
-- Generate a bcrypt hash with `php hash.php` (see repo root), then run:
-- INSERT INTO users (full_name, age, gender, username, email, password, role, created_at, updated_at)
-- VALUES ('Administrator', NULL, NULL, 'you', 'you@gmail.com', '$2y$10$...paste_hash...', 'admin', NOW(), NOW());
