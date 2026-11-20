# Authentication

## Provider
Firebase Authentication is the planned identity provider.

## Flow
1. Frontend uses Firebase client SDK to register/sign in.
2. Firebase issues an ID token.
3. Frontend sends the token as a Bearer token to Spring Boot.
4. Spring Boot Firebase Admin SDK verifies token signature, issuer, audience, and expiry.
5. Backend derives UID from the verified token.
6. Backend loads profile/context and performs authorization.

## Rules
- Never store passwords in Firestore.
- Never trust a UID supplied in request body as identity.
- Handle expired/invalid tokens with appropriate 401 responses.
- Do not log raw tokens.
- Admin credentials remain server-side.
- Account deletion and token revocation policies require explicit design.
