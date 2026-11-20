# ---- Build stage -------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy Maven wrapper and POM first for layer-cached dependency resolution
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

# Copy sources and build, skipping tests (tests run in CI, not in image build)
COPY src/ src/
RUN ./mvnw package -DskipTests -q

# ---- Runtime stage -----------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S agroai && adduser -S agroai -G agroai
USER agroai

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar", \
  "--spring.profiles.active=prod"]
