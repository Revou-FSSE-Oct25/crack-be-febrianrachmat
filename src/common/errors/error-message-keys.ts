/**
 * Maps the literal (in-code) exception messages thrown across the services to
 * i18n keys. The global exception filter consults this map as a fallback when
 * an exception does not already carry an explicit `messageKey`, so every static
 * error message becomes localizable without editing each throw site.
 *
 * The in-code English text is always passed as the translation `defaultValue`,
 * so the `en` response stays byte-identical even when an `en` entry is absent.
 * Dynamic messages (built with template literals) are intentionally not mapped
 * and remain in their in-code language.
 */
export const ERROR_MESSAGE_KEYS: Record<string, string> = {
  // Profiles & users
  'Patient profile not found.': 'errors.PATIENT_PROFILE_NOT_FOUND',
  'Physiotherapist profile not found.': 'errors.PHYSIO_PROFILE_NOT_FOUND',
  'User not found.': 'errors.USER_NOT_FOUND',
  'Physiotherapist not found.': 'errors.PHYSIO_NOT_FOUND',
  'Physiotherapist is not approved yet.': 'errors.PHYSIO_NOT_APPROVED',
  'Physiotherapist not found or not approved yet.':
    'errors.PHYSIO_NOT_FOUND_OR_APPROVED',
  'No profile photo uploaded.': 'errors.AVATAR_NONE',
  'Invalid avatar storage path.': 'errors.AVATAR_PATH_STORAGE_INVALID',
  'Invalid avatar path.': 'errors.AVATAR_PATH_INVALID',
  'Avatar file not found on server.': 'errors.AVATAR_FILE_MISSING',
  'Admin accounts cannot be self-deactivated.':
    'errors.ACCOUNT_ADMIN_NO_DEACTIVATE',
  'Account is already inactive.': 'errors.ACCOUNT_ALREADY_INACTIVE',
  'New password must be different from current password.':
    'errors.PASSWORD_SAME',
  'Current password is incorrect.': 'errors.PASSWORD_CURRENT_WRONG',
  'Your account is inactive.': 'errors.ACCOUNT_INACTIVE',

  // Consultations & bookings
  'Consultation not found.': 'errors.CONSULTATION_NOT_FOUND',
  'IN_PROGRESS is set automatically once the transaction is paid; not assignable manually.':
    'errors.CONSULTATION_INPROGRESS_AUTO',
  'Invalid status for physiotherapist.': 'errors.STATUS_INVALID_PHYSIO',
  'Patient can only mark a consultation completed once it is IN_PROGRESS.':
    'errors.CONSULTATION_PATIENT_COMPLETE_ONLY_INPROGRESS',
  'Patient can only cancel or complete a consultation.':
    'errors.CONSULTATION_PATIENT_CANCEL_COMPLETE_ONLY',
  'Unauthorized role.': 'errors.UNAUTHORIZED_ROLE',
  'clinicAddress is required for CLINIC_VISIT.': 'errors.CLINIC_ADDRESS_REQUIRED',
  'homeVisitAddress is required for HOME_VISIT.':
    'errors.HOME_VISIT_ADDRESS_REQUIRED',
  'consultationId is invalid for this patient.':
    'errors.CONSULTATION_ID_INVALID_PATIENT',
  'consultationId does not match the selected physiotherapist.':
    'errors.CONSULTATION_ID_MISMATCH_PHYSIO',
  'appointmentDate is invalid.': 'errors.APPOINTMENT_DATE_INVALID',
  'slotId is invalid for selected physiotherapist.':
    'errors.SLOT_ID_INVALID_PHYSIO',
  'Selected slot is no longer available.': 'errors.SLOT_UNAVAILABLE',
  'Selected slot has already passed.': 'errors.SLOT_PASSED',
  'appointmentDate must equal slot startTime when slotId is provided.':
    'errors.APPOINTMENT_DATE_MUST_EQUAL_SLOT',
  'appointmentDate is required when slotId is not provided.':
    'errors.APPOINTMENT_DATE_REQUIRED',
  'Selected slot is no longer available. Please choose another time.':
    'errors.SLOT_UNAVAILABLE_CHOOSE_OTHER',
  'from and to must be valid ISO dates.': 'errors.RANGE_DATES_INVALID',
  'from must be before to.': 'errors.RANGE_FROM_BEFORE_TO',
  'Calendar range cannot exceed 93 days.': 'errors.CALENDAR_RANGE_MAX',
  'Booking not found.': 'errors.BOOKING_NOT_FOUND',
  'Patient can only cancel booking.': 'errors.BOOKING_PATIENT_CANCEL_ONLY',
  'Booking can only be rescheduled while still pending confirmation.':
    'errors.BOOKING_RESCHEDULE_PENDING_ONLY',
  'slotId is invalid for this booking therapist.':
    'errors.SLOT_ID_INVALID_BOOKING_THERAPIST',
  'Selected slot has already started or passed.':
    'errors.SLOT_STARTED_OR_PASSED',
  'appointmentDate must be in the future.': 'errors.APPOINTMENT_DATE_FUTURE',
  'Provide exactly one of bookingId or consultationId for a transaction.':
    'errors.TX_XOR_BOOKING_CONSULTATION',
  'Booking not found for current patient.': 'errors.BOOKING_NOT_FOUND_PATIENT',
  'Cannot pay for a cancelled booking.': 'errors.BOOKING_PAY_CANCELLED',
  'A pending or paid transaction already exists for this booking.':
    'errors.TX_EXISTS_BOOKING',
  'Consultation not found for current patient.':
    'errors.CONSULTATION_NOT_FOUND_PATIENT',
  'Cannot pay for a cancelled consultation.':
    'errors.CONSULTATION_PAY_CANCELLED',
  'A pending or paid transaction already exists for this consultation.':
    'errors.TX_EXISTS_CONSULTATION',
  'Transaction not found.': 'errors.TX_NOT_FOUND',
  'Only pending transaction can be marked as paid.':
    'errors.TX_ONLY_PENDING_PAID',
  'Cannot confirm payment: no payment proof is attached to this transaction.':
    'errors.TX_PROOF_REQUIRED',
  'Cannot confirm payment for a cancelled booking.':
    'errors.TX_CONFIRM_CANCELLED_BOOKING',
  'Booking must be CONFIRMED before payment can be approved.':
    'errors.BOOKING_CONFIRM_BEFORE_PAY',
  'Cannot confirm payment for a cancelled consultation.':
    'errors.TX_CONFIRM_CANCELLED_CONSULTATION',
  'Only paid transaction can be refunded.': 'errors.TX_ONLY_PAID_REFUND',
  'Only patient (owner) or admin can view payment proofs.':
    'errors.TX_PROOF_VIEW_FORBIDDEN',
  'No payment proof attached to this transaction.': 'errors.TX_PROOF_NONE',
  'Invalid payment proof storage path.': 'errors.TX_PROOF_PATH_STORAGE_INVALID',
  'Invalid payment proof path.': 'errors.TX_PROOF_PATH_INVALID',
  'Payment proof file not found on server.': 'errors.TX_PROOF_FILE_MISSING',

  // Availability slots
  'Availability slot not found.': 'errors.SLOT_NOT_FOUND',
  'Cannot change slot window while an active booking uses this slot.':
    'errors.SLOT_WINDOW_LOCKED',
  'Cannot mark slot available while an active booking uses it.':
    'errors.SLOT_AVAILABLE_LOCKED',
  'Cannot delete slot with an active (non-cancelled) booking.':
    'errors.SLOT_DELETE_LOCKED',
  'Invalid date/time values.': 'errors.DATETIME_INVALID',
  'startTime must be before endTime.': 'errors.START_BEFORE_END',
  'startTime must be in the future for publishable availability.':
    'errors.START_IN_FUTURE',
  'slotDate must match the UTC calendar day of startTime and endTime.':
    'errors.SLOT_DATE_MATCH_DAY',
  'Slot overlaps an existing availability window for this therapist.':
    'errors.SLOT_OVERLAP',

  // Chat
  'Conversation not found.': 'errors.CONVERSATION_NOT_FOUND',
  'Conversation is not linked to a paid consultation.':
    'errors.CONVERSATION_NOT_PAID',

  // Categories
  'Category name already exists.': 'errors.CATEGORY_DUPLICATE',
  'Category not found.': 'errors.CATEGORY_NOT_FOUND',
  'Category does not exist.': 'errors.CATEGORY_NOT_EXIST',
  'Category is still used by physiotherapists and cannot be deleted.':
    'errors.CATEGORY_IN_USE',

  // Notifications
  'Notification not found.': 'errors.NOTIFICATION_NOT_FOUND',
  'Target user does not exist.': 'errors.TARGET_USER_NOT_FOUND',

  // OAuth
  'FRONTEND_URL is not configured for OAuth redirects.':
    'errors.OAUTH_FRONTEND_URL_MISSING',
  'OAuth provider did not return a user id.': 'errors.OAUTH_NO_USER_ID',
  'Email not provided by the provider. Allow email access and try again.':
    'errors.OAUTH_NO_EMAIL',
  'OAuth cannot create admin accounts.': 'errors.OAUTH_NO_ADMIN',

  // Reviews
  'Review already exists for this booking.': 'errors.REVIEW_EXISTS_BOOKING',
  'Review already exists for this consultation.':
    'errors.REVIEW_EXISTS_CONSULTATION',
  'At least one of rating or comment must be provided.':
    'errors.REVIEW_RATING_OR_COMMENT',
  'Review not found.': 'errors.REVIEW_NOT_FOUND',
  'Only patient can update own review.': 'errors.REVIEW_UPDATE_PATIENT_ONLY',
  'Only patient can delete own review.': 'errors.REVIEW_DELETE_PATIENT_ONLY',
  'Provide exactly one of bookingId or consultationId.': 'errors.REVIEW_XOR',
  'Review can only be created for completed booking.':
    'errors.REVIEW_BOOKING_COMPLETED_ONLY',
  'Review can only be created for completed consultation.':
    'errors.REVIEW_CONSULTATION_COMPLETED_ONLY',
  'Review is currently moderated and cannot be edited or deleted.':
    'errors.REVIEW_LOCKED_MODERATED',

  // Physiotherapist filters & verification
  'minVisitFee cannot be greater than maxVisitFee.':
    'errors.FILTER_VISIT_FEE_RANGE',
  'minConsultationFee cannot be greater than maxConsultationFee.':
    'errors.FILTER_CONSULT_FEE_RANGE',
  'rejectionReason is required when status is REJECTED.':
    'errors.VERIFY_REJECTION_REASON_REQUIRED',
  'Admin verification must be APPROVED or REJECTED.':
    'errors.VERIFY_STATUS_INVALID',

  // Messages authored in Indonesian in-code (English provided via en/errors.json)
  'Respons cepat hanya tersedia saat terapis sedang online (heartbeat aktif). Buka daftar fisioterapis, pastikan badge Online, lalu ajukan lagi.':
    'errors.FAST_RESPONSE_ONLINE_ONLY',
  'Lampirkan bukti pembayaran: unggah gambar (JPEG, PNG, atau WebP) atau tautan https ke bukti Anda.':
    'errors.PAYMENT_PROOF_ATTACH',
  'Akun masuk lewat Google/Apple/GitHub/Facebook. Nonaktifkan lewat penyedia masuk atau hubungi dukungan.':
    'errors.SOCIAL_DEACTIVATE',
  'Akun masuk lewat Google/Apple/GitHub/Facebook. Atur kata sandi belum tersedia untuk akun ini.':
    'errors.SOCIAL_PASSWORD_UNAVAILABLE',

  // Rate limiting (ThrottlerModule message)
  'Terlalu banyak permintaan dari alamat ini. Coba lagi dalam beberapa saat.':
    'common.TOO_MANY_REQUESTS',
};
