# Java 21 Environment Report

**Date:** 2026-11-18 — PASS; existing JDK reused.

JDK path: C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot  
Runtime: OpenJDK Temurin 21.0.13 LTS, build 21.0.13+9-LTS  
Compiler: javac 21.0.13  
JAVA_HOME: user and machine settings point to this JDK (machine value has a trailing slash). Current process PATH was prefixed with its bin directory. where.exe java and javac resolved to that directory. No duplicate JDK was installed.

A stale user PATH entry for C:\Program Files\Java\jdk-24\bin was confirmed absent from disk and was not edited because the JDK 21 path resolved first; no persistent PATH changes were needed.

backend/.mvn/wrapper/maven-wrapper.properties pins Maven 3.9.9 from the Apache Maven Central distribution. The Maven Wrapper JAR was present and the wrapper downloaded/used its pinned distribution.

Exact backend command from backend, after setting current-process JAVA_HOME and PATH:
`$env:JAVA_HOME=[Environment]::GetEnvironmentVariable('JAVA_HOME','User'); $env:Path="$env:JAVA_HOME\bin;$env:Path"; java -version; javac -version; where.exe java; where.exe javac; .\mvnw.cmd test -q`

Historical environment run: Java and javac 21.0.13; Maven exited 0 with the then-current 220-test suite. Fresh 2026-11-18 verification confirms the installed JDK at `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`; Maven Wrapper ran offline with `JAVA_HOME` set for the process and passed the current 216-test suite. See `MILESTONE_6_TEST_REPORT.md` for the exact final command and current count.

