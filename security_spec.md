# Security Specification for Naumen Organizer

## Data Invariants
1. A registration cannot exist without a valid event ID.
2. A user can only register for themselves (userId must match request.auth.uid).
3. Only organizers can create/edit events and polls.
4. Participants can only update their own registrations.
5. Waitlist status is immutable by participants once set (it should be calculated or set by system/organizer, but for MVP we might allow system-like writes if we can't have cloud functions). *However, the instructions forbid server-side logic unless strictly necessary via Express. Since this is a Firestore-heavy app, I'll try to stick to rules to enforce limits.*
6. Chat messages are immutable once created.
7. Questions can only be deleted by the author or organizer.

## The Dirty Dozen Payloads (Target: PERMISSION_DENIED)
1. Creating a registration with a fake `userId`.
2. Updating an event's title as a participant.
3. Increasing `votes` on a question by 100 in one update.
4. Reading another user's private profile info (if we had any, currently split collection is preferred).
5. Deleting an event as a participant.
6. Creating a chat message as a different user.
7. Joining a masterclass that has reached its limit (this is tricky with rules alone, but can be guarded partially with `existsAfter` or `transaction` checks if we use a counter document).
8. Modifying a poll's `options` after it has been created.
9. Injecting a 1MB string into a chat message.
10. Registering with an unverified email (if `email_verified` is required).
11. Spoofing admin status.
12. Accessing the waitlist registration of another user to change their status.

## Test Runner (Example tests)
(I will implement these in `src/tests/firestore.rules.test.ts` or similar if I had a test runner, but for now I'll proceed to rule generation).
