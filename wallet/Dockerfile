# Етап 1: Збірка (Builder)
FROM eclipse-temurin:21-jdk-alpine AS builder

# Встановлюємо Maven
RUN apk add --no-cache maven

WORKDIR /build

# Копіюємо батьківський POM з кореня проекту
COPY pom.xml ./

# Copy wallet module
COPY wallet ./wallet

# Завантажуємо залежності та збираємо проект
WORKDIR /build/wallet
RUN mvn dependency:go-offline -B
RUN mvn clean package -DskipTests

# Етап 2: Запуск (Runtime)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Копіюємо зібраний JAR з першого етапу
COPY --from=builder /build/wallet/target/*.jar app.jar

# Відкриваємо порт
EXPOSE 8083

# Запускаємо додаток
ENTRYPOINT ["java", "-jar", "app.jar"]
