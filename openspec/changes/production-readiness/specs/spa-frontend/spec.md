# Spec Delta

## ADDED Requirements

### Requirement: Sign-in and sign-up screen
The SPA SHALL provide a `/sign-in` route offering email and password sign-in and sign-up, plus buttons for only those social providers the server reports as enabled. After a successful sign-in or sign-up it SHALL navigate to the `redirect` search parameter, but only when that is a same-origin relative path (it starts with `/` and not with `//`); otherwise it SHALL navigate to `/chat`. When email verification is required, a successful sign-up SHALL show a "check your email" message instead of navigating.

#### Scenario: Only configured providers are shown
- **WHEN** the server reports GitHub as the only enabled social provider
- **THEN** the sign-in screen shows a GitHub button and no Google button

#### Scenario: Open-redirect attempt
- **WHEN** a visitor opens `/sign-in?redirect=//evil.example` and signs in
- **THEN** the SPA navigates to `/chat`, not the external site

#### Scenario: Sign-up awaiting verification
- **WHEN** email verification is enabled and a visitor signs up
- **THEN** the screen shows a message asking them to check their email

### Requirement: Password reset screen
The SPA SHALL provide a `/reset-password` route. Without a token it requests a reset link by email. With a `token` query parameter it sets a new password. With an `error` query parameter it shows an invalid or expired link message. The "Forgot password?" entry point SHALL be shown only when the server reports password reset as available.

#### Scenario: Reset link received
- **WHEN** a user opens `/reset-password?token=<valid>` and submits a new password
- **THEN** the password is updated and the user is offered a link to sign in

### Requirement: Protected chat route
The `/chat` route SHALL redirect visitors without a session to `/sign-in`, passing the original location as `redirect`. This guard only affects the UI; the API enforces authorization independently.

#### Scenario: Signed-out visitor opens chat
- **WHEN** a visitor without a session navigates to `/chat`
- **THEN** they are redirected to `/sign-in?redirect=/chat`

#### Scenario: Return after sign-up
- **WHEN** that visitor signs up successfully
- **THEN** they land on `/chat`

### Requirement: Session-aware header
The application header SHALL show a "Sign in" link to visitors who aren't signed in. For signed-in users it SHALL show their email and a "Sign out" action that ends the session and returns to `/`.

#### Scenario: Signed-in header
- **WHEN** a signed-in user views any page
- **THEN** the header shows their email and a Sign out button

### Requirement: Per-visit conversation id
Each visit to the chat page SHALL generate a conversation id and send it with every chat request, so the server saves that visit's turns as one conversation.

#### Scenario: Chat turns grouped
- **WHEN** a user sends several messages during one visit to `/chat`
- **THEN** all of them are saved under the same conversation id
