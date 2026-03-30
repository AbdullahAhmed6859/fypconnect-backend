-- ============================================================
--  FYPConnect — PostgreSQL DDL
--  Team Synergy | Habib University | Spring 2026
--  Derived strictly from the FYPConnect API Documentation v1.0.0
-- ============================================================


-- ============================================================
--  ENUM TYPES
-- ============================================================

CREATE TYPE account_status_enum AS ENUM (
    'pending',
    'active',
    'deleted',
    'blocked'
);

CREATE TYPE match_status_enum AS ENUM (
    'active',
    'unmatched',
    'blocked'
);

CREATE TYPE notification_type_enum AS ENUM (
    'NEW_MATCH',
    'NEW_MESSAGE',
    'PROFILE_UPDATED'
);


-- ============================================================
--  LOOKUP / REFERENCE TABLES
--  (no foreign-key dependencies — must be created first)
-- ============================================================

-- Years
-- year 1 = Freshman, 2 = Sophomore, 3 = Junior, 4 = Senior
-- Only yearId 3 (Junior) and 4 (Senior) are eligible for browsing/matching.
CREATE TABLE Years (
    year_id SERIAL       PRIMARY KEY,
    year    INTEGER      NOT NULL UNIQUE
    CHECK (year BETWEEN 1 AND 4)
);

-- Majors
-- Column name "majors" is taken directly from the data model.
CREATE TABLE Majors (
    major_id SERIAL      PRIMARY KEY,
    majors   VARCHAR     NOT NULL UNIQUE
);

-- Skills
CREATE TABLE Skills (
    skill_id SERIAL      PRIMARY KEY,
    skill    VARCHAR     NOT NULL UNIQUE
);

-- Interests
CREATE TABLE Interests (
    interest_id SERIAL   PRIMARY KEY,
    interest    VARCHAR  NOT NULL UNIQUE
);


-- ============================================================
--  CORE USER TABLE
-- ============================================================

-- Column names, types, and nullability match the data model exactly.
-- "year" and "major" are FK columns whose names are specified as such in the doc.
-- email CHECK enforces the @st.habib.edu.pk domain rule (FR-1, Business Rules).
-- account_status defaults to 'pending' — set to 'active' on email verification.
-- full_name, year, major and profile fields are nullable until profile setup completes.
CREATE TABLE Users (
    user_id                   SERIAL                  PRIMARY KEY,
    email                     VARCHAR                 NOT NULL UNIQUE
    CHECK (email LIKE '%@st.habib.edu.pk'),
    password_hash             VARCHAR                 NOT NULL,
    verified                  BOOLEAN                 NOT NULL DEFAULT FALSE,
    verification_token        VARCHAR,
    verification_expires_at   TIMESTAMP WITH TIME ZONE,
    verification_resend_count INTEGER                 NOT NULL DEFAULT 0,
    verification_sent_at      TIMESTAMP WITH TIME ZONE,
    full_name                 VARCHAR,
    year                      INTEGER                 REFERENCES Years(year_id),
    major                     INTEGER                 REFERENCES Majors(major_id),
    profile_pic               VARCHAR,
    biography                 TEXT,
    ideas                     TEXT,
    profile_updated_at        TIMESTAMP WITH TIME ZONE,
    account_status            account_status_enum     NOT NULL DEFAULT 'pending',
    deletion_time             TIMESTAMP WITH TIME ZONE,
    last_login                TIMESTAMP WITH TIME ZONE,
    created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- ============================================================
--  USER ATTRIBUTE JUNCTION TABLES
-- ============================================================

-- Many-to-many: Users ↔ Skills
CREATE TABLE User_Skills (
    user_skill_id SERIAL    PRIMARY KEY,
    user_id       INTEGER   NOT NULL REFERENCES Users(user_id)  ON DELETE CASCADE,
    skill_id      INTEGER   NOT NULL REFERENCES Skills(skill_id) ON DELETE CASCADE
);

-- Many-to-many: Users ↔ Interests
CREATE TABLE User_Interests (
    user_interest_id SERIAL  PRIMARY KEY,
    user_id          INTEGER  NOT NULL REFERENCES Users(user_id)     ON DELETE CASCADE,
    interest_id      INTEGER  NOT NULL REFERENCES Interests(interest_id) ON DELETE CASCADE
);

-- User external links (github, linkedin, portfolio).
-- Each URL is stored as a separate row; validation is enforced at the application layer.
CREATE TABLE User_Links (
    user_link_id SERIAL    PRIMARY KEY,
    user_id      INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    link         VARCHAR   NOT NULL
    name_        VARCHAR   NOT NULL
);

-- User projects
-- project_link is optional per the data model; project_name is the required descriptor.
CREATE TABLE User_Projects (
    user_project_id SERIAL   PRIMARY KEY,
    user_id         INTEGER  NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    project_link    VARCHAR,
    project_name    VARCHAR  NOT NULL
);


-- ============================================================
--  BROWSING PREFERENCES
--  preferredMajorIds is the only required preference field (FR-7, Business Rules).
--  Skills and interests preferences are optional.
-- ============================================================

CREATE TABLE Major_Preferences (
    major_preference_id SERIAL   PRIMARY KEY,
    user_id             INTEGER  NOT NULL REFERENCES Users(user_id)  ON DELETE CASCADE,
    preferred_major_id  INTEGER  NOT NULL REFERENCES Majors(major_id) ON DELETE CASCADE
);

CREATE TABLE Skills_Preferences (
    skill_preference_id SERIAL   PRIMARY KEY,
    user_id             INTEGER  NOT NULL REFERENCES Users(user_id)  ON DELETE CASCADE,
    preferred_skill_id  INTEGER  NOT NULL REFERENCES Skills(skill_id) ON DELETE CASCADE
);

CREATE TABLE Interests_Preferences (
    interest_preference_id SERIAL  PRIMARY KEY,
    user_id                INTEGER NOT NULL REFERENCES Users(user_id)      ON DELETE CASCADE,
    preferred_interest_id  INTEGER NOT NULL REFERENCES Interests(interest_id) ON DELETE CASCADE
);


-- ============================================================
--  BROWSE INTERACTIONS
-- ============================================================

-- Likes
-- UNIQUE(liker_id, liked_id) enforces the duplicate-prevention business rule.
-- A user cannot like their own profile — enforced at the application layer (POST /browse/like returns 409).
CREATE TABLE Likes (
    like_id    SERIAL    PRIMARY KEY,
    liker_id   INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    liked_id   INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (liker_id, liked_id)
);

-- Passes
-- Passes are permanent — there is no undo (FR-11, Business Rules).
-- UNIQUE(passer_id, passed_id) prevents duplicate pass records.
CREATE TABLE Passes (
    pass_id    SERIAL    PRIMARY KEY,
    passer_id  INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    passed_id  INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (passer_id, passed_id)
);


-- ============================================================
--  MATCHES
-- ============================================================

-- A match is created atomically when two users mutually like each other (FR-12).
-- UNIQUE(user1_id, user2_id) prevents duplicate match records per pair.
-- status defaults to 'active'; set to 'unmatched' or 'blocked' by account-control endpoints.
CREATE TABLE Matches (
    match_id   SERIAL              PRIMARY KEY,
    user1_id   INTEGER             NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    user2_id   INTEGER             NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    status     match_status_enum   NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user1_id, user2_id)
);


-- ============================================================
--  MESSAGES
-- ============================================================

-- Text-only messages between actively matched users (FR-13, FR-14, FR-15).
-- Max 1000 characters enforced by CHECK constraint, mirroring the API validation rule.
-- sender_id uses ON DELETE SET NULL so that chat history is preserved and the
-- sender's name can be anonymised as [Deleted User] per the data-retention policy (NFR-7).
-- unread defaults to TRUE; cleared when the recipient opens the conversation
-- via GET /chat/conversations/{matchId}.
CREATE TABLE Messages (
    message_id SERIAL    PRIMARY KEY,
    match_id   INTEGER   NOT NULL REFERENCES Matches(match_id) ON DELETE CASCADE,
    sender_id  INTEGER   REFERENCES Users(user_id) ON DELETE SET NULL,
    message    TEXT      NOT NULL CHECK (LENGTH(message) <= 1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    unread     BOOLEAN   NOT NULL DEFAULT TRUE
);


-- ============================================================
--  BLOCKED USERS
-- ============================================================

-- Block is match-scoped: accessed from within an existing match/chat context (FR-18).
-- Applying a block also unmatches the pair and prevents any future rematching.
-- UNIQUE(blocker_id, blocked_id) prevents duplicate block records.
CREATE TABLE Blocked_Users (
    block_id   SERIAL    PRIMARY KEY,
    blocker_id INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    blocked_id INTEGER   NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    UNIQUE (blocker_id, blocked_id)
);


-- ============================================================
--  NOTIFICATIONS
-- ============================================================

-- Stores NEW_MATCH, NEW_MESSAGE, and PROFILE_UPDATED indicators (FR-16).
-- user_id is the recipient of the notification.
-- read defaults to FALSE; set to TRUE when the relevant view is opened:
--   NEW_MATCH / NEW_MESSAGE  → cleared by GET /chat/conversations/{matchId}
--   PROFILE_UPDATED          → cleared by GET /matches/{matchId}/updated-profile
CREATE TABLE Notifications (
    notification_id SERIAL                  PRIMARY KEY,
    user_id         INTEGER                 NOT NULL REFERENCES Users(user_id)  ON DELETE CASCADE,
    match_id        INTEGER                 NOT NULL REFERENCES Matches(match_id) ON DELETE CASCADE,
    type            notification_type_enum  NOT NULL,
    read            BOOLEAN                 NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- ============================================================
--  AUTH LOGS
-- ============================================================

-- Security audit log for all login attempts — both successful and failed (FR-3).
-- user_id is nullable: when the attempted email does not match any account,
-- no user_id is available, so the row records only email_attempted.
-- ON DELETE SET NULL retains the audit record even if the account is later deleted
-- (audit logs are retained for 90 days per NFR-7).
CREATE TABLE Auth_Logs (
    log_id          SERIAL    PRIMARY KEY,
    user_id         INTEGER   REFERENCES Users(user_id) ON DELETE SET NULL,
    email_attempted VARCHAR   NOT NULL,
    success         BOOLEAN   NOT NULL,
    timestamp       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);