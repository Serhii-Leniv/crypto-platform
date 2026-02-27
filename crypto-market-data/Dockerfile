# Етап 1: Збірка (Builder)
FROM eclipse-temurin:21-jdk-alpine AS builder

# Встановлюємо Maven
RUN apk add --no-cache maven

WORKDIR /build

# Копіюємо батьківський POM з кореня проекту
COPY pom.xml ./

# Копіюємо весь модуль crypto-market-data
COPY crypto-market-data ./crypto-market-data

# Завантажуємо залежності та збираємо проект
WORKDIR /build/crypto-market-data
RUN mvn clean package -DskipTests

# Етап 2: Запуск (Runtime)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Копіюємо зібраний JAR з першого етапу
COPY --from=builder /build/crypto-market-data/target/*.jar app.jar

# Відкриваємо порт
EXPOSE 8084

# Запускаємо додаток
ENTRYPOINT ["java", "-jar", "app.jar"]
