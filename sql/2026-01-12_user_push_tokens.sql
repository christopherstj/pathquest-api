-- Migration: Create user_push_tokens table for push notification support
-- Date: 2026-01-12
-- Description: Stores Expo push notification tokens for users

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Index for efficient lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Index for efficient lookup by token (for token validation/removal)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON user_push_tokens(token);

-- Add notification preferences to user_settings if not exists
-- This controls whether the user wants to receive summit notifications
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_settings' 
        AND column_name = 'summit_notifications_enabled'
    ) THEN
        ALTER TABLE user_settings 
        ADD COLUMN summit_notifications_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

COMMENT ON TABLE user_push_tokens IS 'Stores Expo push notification tokens for users';
COMMENT ON COLUMN user_push_tokens.user_id IS 'Reference to the user who owns this token';
COMMENT ON COLUMN user_push_tokens.token IS 'Expo push notification token';
COMMENT ON COLUMN user_push_tokens.platform IS 'Device platform (ios or android)';




