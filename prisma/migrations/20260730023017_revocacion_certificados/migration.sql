-- AlterTable
ALTER TABLE "public"."Certificado" ADD COLUMN     "motivoRevocacion" TEXT,
ADD COLUMN     "revocadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Cliente" ALTER COLUMN "actualizadoEn" SET DEFAULT CURRENT_TIMESTAMP;
