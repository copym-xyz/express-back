# Authentication System Architecture

This document describes the modular authentication system architecture implemented in this project.

## Structure

The authentication system follows a modular architecture with:

```
backend/
├── routes/
│   └── auth/
│       └── auth.routes.js
├── controllers/
│   └── auth/
│       ├── auth.controller.js
│       ├── admin.controller.js
│       ├── issuer.controller.js
│       └── investor.controller.js
├── services/
│   └── auth/
│       ├── auth.service.js
│       ├── admin.service.js
│       ├── issuer.service.js
│       └── investor.service.js
```

## Components

### Routes

- **auth.routes.js**: Defines all authentication-related routes for admin, issuer, and investor users.

### Controllers

- **auth.controller.js**: Base controller with shared authentication functions.
- **admin.controller.js**: Handles admin-specific authentication requests.
- **issuer.controller.js**: Handles issuer-specific authentication requests.
- **investor.controller.js**: Handles investor-specific authentication requests.

### Services

- **auth.service.js**: Base service with shared authentication logic.
- **admin.service.js**: Business logic for admin authentication.
- **issuer.service.js**: Business logic for issuer authentication.
- **investor.service.js**: Business logic for investor authentication.

## Authentication Flow

1. **Routes** receive HTTP requests and delegate to appropriate controllers.
2. **Controllers** process request data and call the appropriate service methods.
3. **Services** implement the business logic, interact with the database, and return results.

## Endpoints

### Admin Authentication
- `POST /api/auth/admin/login`: Admin login

### Issuer Authentication
- `POST /api/auth/issuer/login`: Issuer login
- `POST /api/auth/issuer/register`: Issuer registration

### Investor Authentication
- `POST /api/auth/investor/login`: Investor login
- `POST /api/auth/investor/register`: Investor registration
- `GET /api/auth/google`: Google OAuth for investor login
- `GET /api/auth/google/callback`: Google OAuth callback

## OAuth Flow

The OAuth flow allows users to authenticate using Google (primarily for investors):

1. User initiates OAuth login by visiting `/api/auth/google`
2. The system stores the role hint from the query parameter
3. After Google authentication, the callback route processes the response
4. User profile is processed by the `investor.service.handleOAuthCallback` method
5. Either a new user is created or an existing user is retrieved
6. A JWT token is generated and sent back to the client 