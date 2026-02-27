# Етап 1: Збірка (Builder)
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Копіюємо батьківський POM з кореня проекту
COPY pom.xml ./

# Копіюємо  весь модуль crypto-auth
COPY crypto-auth ./crypto-auth

# Надаємо права на виконання mvnw
RUN chmod +x crypto-auth/mvnw

# Завантажуємо залежності та збираємо проект
WORKDIR /build/crypto-auth
RUN ./mvnw dependency:go-offline -B
RUN ./mvnw clean package -DskipTests

# Етап 2: Запуск (Runtime)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Копіюємо зібраний JAR з першого етапу
COPY --from=builder /build/crypto-auth/target/*.jar app.jar

# Відкриваємо порт
EXPOSE 8081

# Запускаємо додаток
ENTRYPOINT ["java", "-jar", "app.jar"]