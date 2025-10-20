-- Fix RLS policies for booking_payments table
-- Allow match creators and admins to manage payment records

-- Drop existing policies if any
DROP POLICY IF EXISTS "Match creators can view booking payments" ON booking_payments;
DROP POLICY IF EXISTS "Match creators can create booking payments" ON booking_payments;
DROP POLICY IF EXISTS "Match creators can update booking payments" ON booking_payments;

-- SELECT policy - allow match creators and admins to view payment records for their matches
CREATE POLICY "Match creators and admins can view booking payments" ON booking_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN matches ON matches.id = bookings.match_id
      WHERE bookings.id = booking_payments.booking_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  );

-- INSERT policy - allow match creators and admins to create payment records
CREATE POLICY "Match creators and admins can create booking payments" ON booking_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN matches ON matches.id = bookings.match_id
      WHERE bookings.id = booking_payments.booking_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  );

-- UPDATE policy - allow match creators and admins to update payment records
CREATE POLICY "Match creators and admins can update booking payments" ON booking_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN matches ON matches.id = bookings.match_id
      WHERE bookings.id = booking_payments.booking_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN matches ON matches.id = bookings.match_id
      WHERE bookings.id = booking_payments.booking_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  );

-- DELETE policy - allow match creators and admins to delete payment records
CREATE POLICY "Match creators and admins can delete booking payments" ON booking_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN matches ON matches.id = bookings.match_id
      WHERE bookings.id = booking_payments.booking_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  );

COMMENT ON POLICY "Match creators and admins can view booking payments" ON booking_payments IS
'Allows match creators and admins to view payment records for bookings in their matches';

COMMENT ON POLICY "Match creators and admins can create booking payments" ON booking_payments IS
'Allows match creators and admins to create payment records for bookings in their matches';

COMMENT ON POLICY "Match creators and admins can update booking payments" ON booking_payments IS
'Allows match creators and admins to update payment status for bookings in their matches';

COMMENT ON POLICY "Match creators and admins can delete booking payments" ON booking_payments IS
'Allows match creators and admins to delete payment records for bookings in their matches';
