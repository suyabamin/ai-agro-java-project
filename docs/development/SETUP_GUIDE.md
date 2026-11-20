# Setup Guide

## Prerequisites
- VS Code
- Git
- Node.js LTS and npm
- Compatible JDK (JDK 21 is the proposed baseline, subject to Spring Boot compatibility)
- Maven or Maven Wrapper
- Python 3.12+ (confirm compatibility with selected dependencies)

## Setup sequence
1. Clone/open the repository.
2. Verify tool versions.
3. Install frontend dependencies using the lockfile.
4. Build backend using Maven Wrapper where available.
5. Create a Python virtual environment.
6. Install AI-service requirements.
7. Configure local environment variables.
8. Configure Firebase credentials securely when the Firebase project is ready.
9. Start each service independently.
10. Run tests.

## Windows note
Prefer PowerShell commands and document any execution-policy or path issues. Do not change machine-wide policies without user approval.
