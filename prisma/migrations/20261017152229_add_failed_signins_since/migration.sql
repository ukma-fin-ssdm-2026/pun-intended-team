ALTER TABLE "accounts" ADD COLUMN     "failed_signins_since" TIMESTAMPTZ(3);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_failed_signins_window_check"
    CHECK (("failed_signins" = 0) = ("failed_signins_since" IS NULL));

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_failed_signins_not_negative_check"
    CHECK ("failed_signins" >= 0);
