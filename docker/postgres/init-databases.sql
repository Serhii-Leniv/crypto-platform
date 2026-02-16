-- Create all databases for microservices
CREATE DATABASE order_db;
CREATE DATABASE wallet_db;
CREATE DATABASE market_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE auth_db TO crypto_user;
GRANT ALL PRIVILEGES ON DATABASE order_db TO crypto_user;
GRANT ALL PRIVILEGES ON DATABASE wallet_db TO crypto_user;
GRANT ALL PRIVILEGES ON DATABASE market_db TO crypto_user;
