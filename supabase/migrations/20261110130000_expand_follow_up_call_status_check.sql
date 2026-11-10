-- Keep the Follow-Up Hub call status constraint aligned with the statuses
-- currently recorded by the manual calling workflow.
--
-- The previous CHECK constraint rejected valid UI values (SQLSTATE 23514),
-- preventing call logs from being saved.

ALTER TABLE public.follow_up_calls
  DROP CONSTRAINT IF EXISTS follow_up_calls_status_check;

ALTER TABLE public.follow_up_calls
  ADD CONSTRAINT follow_up_calls_status_check
  CHECK (
    status IN (
      -- Current unsuccessful-attempt statuses
      'unreachable',
      'not_connecting',
      'ringing_no_answer',
      'busy',
      'rejected',
      'voicemail',
      'wrong_number',

      -- Current reached/conversation statuses
      'staying',
      'needs_another_call',
      'not_interested',
      'moved_away',
      'prayer_request_raised',

      -- Legacy values retained for existing records and older clients
      'connected',
      'answered',
      'no_answer',
      'not_reached',
      'call_back_requested'
    )
  );
