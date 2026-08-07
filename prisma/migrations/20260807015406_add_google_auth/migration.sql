-- AlterTable: passwordHash pasa a ser opcional (cuentas creadas con
-- "Continuar con Google" no tienen una hasta que, si quieren, la
-- establecen luego vía "Olvidé mi contraseña"), y se agrega googleId para
-- vincular la cuenta con el `sub` de Google.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
