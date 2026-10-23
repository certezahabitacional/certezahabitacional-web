ALTER TABLE "ConstructibilidadPM" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LineaBasePM" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "ConstructibilidadPM" FROM anon, authenticated;
REVOKE ALL ON TABLE "LineaBasePM" FROM anon, authenticated;
