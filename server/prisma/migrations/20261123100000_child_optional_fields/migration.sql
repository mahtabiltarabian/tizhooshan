-- Only the nickname is required: grade and birth year may be left out.
ALTER TABLE "children" ALTER COLUMN "grade" DROP NOT NULL;
ALTER TABLE "children" ALTER COLUMN "birth_year" DROP NOT NULL;
