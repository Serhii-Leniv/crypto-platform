FROM postgres:15-alpine

# Copy initialization script
COPY init-databases.sql /docker-entrypoint-initdb.d/

# Set environment variables (can be overridden)
ENV POSTGRES_USER=crypto_user
ENV POSTGRES_PASSWORD=crypto_password
ENV POSTGRES_DB=auth_db
