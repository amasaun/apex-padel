-- ================================================
-- Add Payment Support (Venmo/Zelle)
-- ================================================

-- Add payment fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS venmo_username TEXT,
ADD COLUMN IF NOT EXISTS zelle_handle TEXT;

-- Add total cost field to matches table
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 2);

-- Create booking_payments table to track payment status
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL,
  marked_as_paid BOOLEAN DEFAULT false,
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id ON booking_payments(booking_id);

-- Enable RLS for booking_payments
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_payments
-- Users can view their own payment records
DROP POLICY IF EXISTS "Users can view their own payment records" ON booking_payments;
CREATE POLICY "Users can view their own payment records" ON booking_payments
FOR SELECT USING (
  booking_id IN (
    SELECT id FROM bookings WHERE user_id = auth.uid()
  )
);

-- Match creators can view all payment records for their matches
DROP POLICY IF EXISTS "Match creators can view payment records" ON booking_payments;
CREATE POLICY "Match creators can view payment records" ON booking_payments
FOR SELECT USING (
  booking_id IN (
    SELECT b.id FROM bookings b
    JOIN matches m ON b.match_id = m.id
    WHERE m.created_by = auth.uid()
  )
);

-- Users can insert their own payment records
DROP POLICY IF EXISTS "Users can insert their own payment records" ON booking_payments;
CREATE POLICY "Users can insert their own payment records" ON booking_payments
FOR INSERT WITH CHECK (
  booking_id IN (
    SELECT id FROM bookings WHERE user_id = auth.uid()
  )
);

-- Users can update their own payment records
DROP POLICY IF EXISTS "Users can update their own payment records" ON booking_payments;
CREATE POLICY "Users can update their own payment records" ON booking_payments
FOR UPDATE USING (
  booking_id IN (
    SELECT id FROM bookings WHERE user_id = auth.uid()
  )
);

-- Match creators can update payment records for their matches
DROP POLICY IF EXISTS "Match creators can update payment records" ON booking_payments;
CREATE POLICY "Match creators can update payment records" ON booking_payments
FOR UPDATE USING (
  booking_id IN (
    SELECT b.id FROM bookings b
    JOIN matches m ON b.match_id = m.id
    WHERE m.created_by = auth.uid()
  )
);

-- Add comment explaining the payment model
COMMENT ON COLUMN matches.total_cost IS 'Total cost the creator paid for the court. Will be split among all players who book.';
COMMENT ON TABLE booking_payments IS 'Tracks payment status for each booking. Amount is calculated as total_cost / number_of_bookings.';
