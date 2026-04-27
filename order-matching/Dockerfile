# Етап 1: Збірка (Builder)
FROM eclipse-temurin:21-jdk-alpine AS builder

# Встановлюємо Maven
RUN apk add --no-cache maven

WORKDIR /build

# Копіюємо батьківський POM з кореня проекту
COPY pom.xml ./

# Copy order-matching module
COPY order-matching ./order-matching

# Завантажуємо залежності та збираємо проект
WORKDIR /build/order-matching
RUN mvn dependency:go-offline -B
RUN mvn clean package -DskipTests

# Етап 2: Запуск (Runtime)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Копіюємо зібраний JAR з першого етапу
COPY --from=builder /build/order-matching/target/*.jar app.jar

# Відкриваємо порт
EXPOSE 8082

# Запускаємо додаток
ENTRYPOINT ["java", "-jar", "app.jar"]
