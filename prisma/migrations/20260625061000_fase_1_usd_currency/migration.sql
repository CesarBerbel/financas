INSERT INTO "Currency" ("code", "name", "symbol", "createdAt")
VALUES ('USD', 'Dólar americano', '$', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "symbol" = EXCLUDED."symbol";
