-- Granular point attribution: nullable subtype on each rally.
--   us_positive -> ace | kill | block
--   us_error    -> serve | reception | attack | other
-- Nullable + additive: existing rallies remain valid (subtype stays NULL).
ALTER TABLE "rallies" ADD COLUMN "point_subtype" TEXT;
