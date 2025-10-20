-- Fix RLS policies for guest_booking_payments table
-- Allow match creators and admins to manage guest payment records

-- Drop existing policies if any
DROP POLICY IF EXISTS "Match creators can view guest booking payments" ON guest_booking_payments;
DROP POLICY IF EXISTS "Match creators can create guest booking payments" ON guest_booking_payments;
DROP POLICY IF EXISTS "Match creators can update guest booking payments" ON guest_booking_payments;

-- SELECT policy
CREATE POLICY "Match creators and admins can view guest booking payments" ON guest_booking_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
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

-- INSERT policy
CREATE POLICY "Match creators and admins can create guest booking payments" ON guest_booking_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
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

-- UPDATE policy
CREATE POLICY "Match creators and admins can update guest booking payments" ON guest_booking_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
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
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
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

-- DELETE policy
CREATE POLICY "Match creators and admins can delete guest booking payments" ON guest_booking_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
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
